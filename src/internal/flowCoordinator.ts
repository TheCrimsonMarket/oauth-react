import { pollPopupClosed } from './popup';
import type { PopupResult, TcmOAuthError, TcmOAuthPhase, TcmProvider } from '../types';

type FlowStage = 'awaiting_callback' | 'awaiting_exchange';
type FlowSubscriber = () => void;

interface ActiveFlow {
  flowId: string;
  ownerInstanceId: string;
  popup: Window | null;
  expectedOrigin: string;
  stage: FlowStage;
  stageStartedAt: number;
  stopPolling: (() => void) | null;
  closeConfirmTimer: number | null;
  exchangeStarted: boolean;
  terminal: boolean;
  onPopupResult: (result: PopupResult) => void | Promise<void>;
  onPopupClosed: () => void;
}

export interface FlowSnapshot {
  phase: TcmOAuthPhase;
  error: TcmOAuthError | null;
  activeFlowId: string | null;
  activeProvider: TcmProvider | null;
  ownerInstanceId: string | null;
  exchangeStarted: boolean;
  terminal: boolean;
  authenticating: boolean;
}

interface FlowCoordinatorState {
  startLocked: boolean;
  startLockedAt: number | null;
  activeFlow: ActiveFlow | null;
  consumedStates: Map<string, number>;
  claimedTransactions: Map<string, number>;
  messageListenerAttached: boolean;
  snapshot: FlowSnapshot;
  subscribers: Set<FlowSubscriber>;
}

type FlowCoordinatorWindow = Window & {
  __tcmOauthFlowCoordinatorState?: FlowCoordinatorState;
};

const CALLBACK_STATE_TTL_MS = 10 * 60 * 1000;
const TRANSACTION_CLAIM_TTL_MS = 15 * 60 * 1000;
const EXCHANGE_STAGE_STALE_MS = 2 * 60 * 1000;
const START_LOCK_STALE_MS = 15 * 1000;
const POPUP_CLOSE_CONFIRM_MS = 1200;

function isPopupResult(data: unknown): data is PopupResult {
  if (!data || typeof data !== 'object') return false;
  return (data as { type?: string }).type === 'tcm_oauth_result';
}

function createSnapshot(): FlowSnapshot {
  return {
    phase: 'idle',
    error: null,
    activeFlowId: null,
    activeProvider: null,
    ownerInstanceId: null,
    exchangeStarted: false,
    terminal: false,
    authenticating: false,
  };
}

function createState(): FlowCoordinatorState {
  return {
    startLocked: false,
    startLockedAt: null,
    activeFlow: null,
    consumedStates: new Map<string, number>(),
    claimedTransactions: new Map<string, number>(),
    messageListenerAttached: false,
    snapshot: createSnapshot(),
    subscribers: new Set<FlowSubscriber>(),
  };
}

function getState(): FlowCoordinatorState {
  if (typeof window === 'undefined') {
    return createState();
  }

  const coordinatorWindow = window as FlowCoordinatorWindow;
  if (!coordinatorWindow.__tcmOauthFlowCoordinatorState) {
    coordinatorWindow.__tcmOauthFlowCoordinatorState = createState();
  }
  return coordinatorWindow.__tcmOauthFlowCoordinatorState;
}

function pruneConsumedStates(state: FlowCoordinatorState, now = Date.now()): void {
  state.consumedStates.forEach((consumedAt, callbackState) => {
    if (now - consumedAt > CALLBACK_STATE_TTL_MS) {
      state.consumedStates.delete(callbackState);
    }
  });
}

function pruneClaimedTransactions(state: FlowCoordinatorState, now = Date.now()): void {
  state.claimedTransactions.forEach((claimedAt, flowId) => {
    if (now - claimedAt > TRANSACTION_CLAIM_TTL_MS) {
      state.claimedTransactions.delete(flowId);
    }
  });
}

function notifySubscribers(state: FlowCoordinatorState): void {
  state.subscribers.forEach((subscriber) => {
    subscriber();
  });
}

function publishSnapshot(state: FlowCoordinatorState, patch: Partial<FlowSnapshot>): void {
  const prev = state.snapshot;
  const draft = {
    ...prev,
    ...patch,
  };
  const next = {
    ...draft,
    authenticating: draft.phase !== 'idle' && draft.phase !== 'done' && draft.phase !== 'error',
  };

  const changed =
    prev.phase !== next.phase ||
    prev.error !== next.error ||
    prev.activeFlowId !== next.activeFlowId ||
    prev.activeProvider !== next.activeProvider ||
    prev.ownerInstanceId !== next.ownerInstanceId ||
    prev.exchangeStarted !== next.exchangeStarted ||
    prev.terminal !== next.terminal ||
    prev.authenticating !== next.authenticating;

  if (!changed) return;
  state.snapshot = next;
  notifySubscribers(state);
}

function consumeCallbackState(state: FlowCoordinatorState, callbackState: string): boolean {
  pruneConsumedStates(state);
  if (state.consumedStates.has(callbackState)) {
    return false;
  }
  state.consumedStates.set(callbackState, Date.now());
  return true;
}

function clearActiveFlow(state: FlowCoordinatorState, preserveSnapshot = false): void {
  const active = state.activeFlow;
  if (!active) return;

  active.stopPolling?.();
  active.stopPolling = null;
  if (active.closeConfirmTimer !== null) {
    if (typeof window !== 'undefined') {
      window.clearTimeout(active.closeConfirmTimer);
    }
    active.closeConfirmTimer = null;
  }
  active.terminal = true;
  state.activeFlow = null;

  if (preserveSnapshot) {
    publishSnapshot(state, { activeFlowId: null });
    return;
  }

  publishSnapshot(state, createSnapshot());
}

function pruneStaleActiveFlow(state: FlowCoordinatorState): void {
  const active = state.activeFlow;
  if (!active) return;

  if (active.stage === 'awaiting_callback') {
    if (!active.popup || active.popup.closed) {
      clearActiveFlow(state);
    }
    return;
  }

  if (Date.now() - active.stageStartedAt > EXCHANGE_STAGE_STALE_MS) {
    clearActiveFlow(state);
  }
}

function detachMessageListener(state: FlowCoordinatorState): void {
  if (typeof window === 'undefined') return;
  if (!state.messageListenerAttached) return;
  window.removeEventListener('message', handlePopupMessage);
  state.messageListenerAttached = false;
}

function syncMessageListener(state: FlowCoordinatorState): void {
  if (typeof window === 'undefined') return;

  if (state.activeFlow && !state.messageListenerAttached) {
    window.addEventListener('message', handlePopupMessage);
    state.messageListenerAttached = true;
    return;
  }

  if (!state.activeFlow) {
    detachMessageListener(state);
  }
}

function handlePopupMessage(event: MessageEvent): void {
  const state = getState();
  const active = state.activeFlow;
  if (!active) {
    syncMessageListener(state);
    return;
  }

  if (active.stage !== 'awaiting_callback') return;
  if (!isPopupResult(event.data)) return;
  if (event.origin !== active.expectedOrigin) return;
  if (event.source !== active.popup) return;
  if (active.terminal) return;
  if (active.exchangeStarted) return;

  const callbackState = typeof event.data.state === 'string' ? event.data.state : '';
  if (callbackState && !consumeCallbackState(state, callbackState)) {
    return;
  }

  if (active.closeConfirmTimer !== null) {
    window.clearTimeout(active.closeConfirmTimer);
    active.closeConfirmTimer = null;
  }

  active.exchangeStarted = true;
  active.stage = 'awaiting_exchange';
  active.stageStartedAt = Date.now();
  active.stopPolling?.();
  active.stopPolling = null;
  active.popup = null;

  publishSnapshot(state, {
    phase: 'exchanging_partner',
    error: null,
    activeFlowId: active.flowId,
    ownerInstanceId: active.ownerInstanceId,
    exchangeStarted: true,
    terminal: false,
  });

  Promise.resolve(active.onPopupResult(event.data)).catch((cause) => {
    console.error('[tcm-oauth-sdk] popup result handler failed', cause);
  });
}

function createFlowId(): string {
  return `tcm_flow_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface AcquireStartSlotResult {
  acquired: boolean;
  focusedExistingPopup: boolean;
}

export function tryAcquireFlowStartSlot(): AcquireStartSlotResult {
  const state = getState();
  pruneStaleActiveFlow(state);

  if (state.startLocked && state.startLockedAt && Date.now() - state.startLockedAt > START_LOCK_STALE_MS) {
    state.startLocked = false;
    state.startLockedAt = null;
  }

  if (state.startLocked) {
    return {
      acquired: false,
      focusedExistingPopup: focusActivePopup(),
    };
  }

  if (state.activeFlow) {
    return {
      acquired: false,
      focusedExistingPopup: focusActivePopup(),
    };
  }

  state.startLocked = true;
  state.startLockedAt = Date.now();
  return {
    acquired: true,
    focusedExistingPopup: false,
  };
}

export function releaseFlowStartSlot(): void {
  const state = getState();
  state.startLocked = false;
  state.startLockedAt = null;
}

export function focusActivePopup(): boolean {
  const state = getState();
  const active = state.activeFlow;
  if (!active) return false;
  if (active.stage !== 'awaiting_callback') return false;
  if (!active.popup || active.popup.closed) return false;

  if (typeof active.popup.focus === 'function') {
    active.popup.focus();
  }
  return true;
}

export interface ActivatePopupFlowOptions {
  popup: Window;
  expectedOrigin: string;
  provider?: TcmProvider | null;
  ownerInstanceId: string;
  onPopupResult: (result: PopupResult) => void | Promise<void>;
  onPopupClosed: () => void;
}

export function activatePopupFlow(options: ActivatePopupFlowOptions): string {
  const state = getState();
  const flowId = createFlowId();
  const { popup, expectedOrigin, provider, ownerInstanceId, onPopupResult, onPopupClosed } = options;

  clearActiveFlow(state);

  const activeFlow: ActiveFlow = {
    flowId,
    ownerInstanceId,
    popup,
    expectedOrigin,
    stage: 'awaiting_callback',
    stageStartedAt: Date.now(),
    stopPolling: null,
    closeConfirmTimer: null,
    exchangeStarted: false,
    terminal: false,
    onPopupResult,
    onPopupClosed,
  };

  activeFlow.stopPolling = pollPopupClosed(popup, () => {
    const latestState = getState();
    const currentFlow = latestState.activeFlow;
    if (!currentFlow || currentFlow.flowId !== flowId) return;
    if (currentFlow.stage !== 'awaiting_callback') return;
    if (currentFlow.closeConfirmTimer !== null) return;

    currentFlow.closeConfirmTimer = window.setTimeout(() => {
      const timeoutState = getState();
      const timeoutFlow = timeoutState.activeFlow;
      if (!timeoutFlow || timeoutFlow.flowId !== flowId) return;
      if (timeoutFlow.stage !== 'awaiting_callback') return;
      if (timeoutFlow.exchangeStarted || timeoutFlow.terminal) return;

      clearActiveFlow(timeoutState);
      syncMessageListener(timeoutState);
      timeoutFlow.onPopupClosed();
    }, POPUP_CLOSE_CONFIRM_MS);
  });

  state.activeFlow = activeFlow;
  state.startLocked = false;
  state.startLockedAt = null;
  publishSnapshot(state, {
    phase: 'interactive_provider',
    error: null,
    activeFlowId: flowId,
    activeProvider: provider ?? null,
    ownerInstanceId,
    exchangeStarted: false,
    terminal: false,
  });
  syncMessageListener(state);
  return flowId;
}

export function finishPopupFlow(flowId: string | null): void {
  const state = getState();
  if (!flowId) return;

  if (!state.activeFlow || state.activeFlow.flowId !== flowId) {
    state.startLocked = false;
    state.startLockedAt = null;
    syncMessageListener(state);
    return;
  }

  clearActiveFlow(state, true);
  state.startLocked = false;
  state.startLockedAt = null;
  syncMessageListener(state);
}

export function claimFlowTransaction(flowId: string): boolean {
  const state = getState();
  pruneClaimedTransactions(state);

  if (state.claimedTransactions.has(flowId)) {
    return false;
  }

  state.claimedTransactions.set(flowId, Date.now());
  return true;
}

export function subscribeFlowSnapshot(subscriber: FlowSubscriber): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const state = getState();
  state.subscribers.add(subscriber);
  return () => {
    state.subscribers.delete(subscriber);
  };
}

export function getFlowSnapshot(): FlowSnapshot {
  return getState().snapshot;
}

export function setPreparingFlow(ownerInstanceId: string, provider?: TcmProvider | null): void {
  const state = getState();
  publishSnapshot(state, {
    phase: 'preparing',
    error: null,
    activeFlowId: null,
    activeProvider: provider ?? null,
    ownerInstanceId,
    terminal: false,
    exchangeStarted: false,
  });
}

export function setFlowExchanging(flowId: string): void {
  const state = getState();
  const snapshot = state.snapshot;
  if (snapshot.activeFlowId && snapshot.activeFlowId !== flowId) return;

  publishSnapshot(state, {
    phase: 'exchanging_partner',
    error: null,
    activeFlowId: flowId,
    exchangeStarted: true,
    terminal: false,
  });
}

interface SetFlowErrorOptions {
  flowId?: string | null;
  ownerInstanceId?: string | null;
}

export function setFlowError(error: TcmOAuthError, options: SetFlowErrorOptions = {}): void {
  const state = getState();
  const snapshot = state.snapshot;
  const flowId = options.flowId ?? null;
  if (flowId && snapshot.activeFlowId && snapshot.activeFlowId !== flowId) return;

  publishSnapshot(state, {
    phase: 'error',
    error,
    activeProvider: error.provider ?? snapshot.activeProvider ?? null,
    ownerInstanceId: options.ownerInstanceId ?? snapshot.ownerInstanceId,
    terminal: true,
    exchangeStarted: flowId ? snapshot.exchangeStarted : false,
    activeFlowId: flowId ?? null,
  });
}

export function setFlowDone(flowId: string | null): void {
  const state = getState();
  const snapshot = state.snapshot;
  if (flowId && snapshot.activeFlowId && snapshot.activeFlowId !== flowId) return;

  publishSnapshot(state, {
    phase: 'done',
    error: null,
    activeFlowId: flowId ?? null,
    activeProvider: null,
    exchangeStarted: true,
    terminal: true,
  });
}

export function resetSharedFlowState(): void {
  const state = getState();
  clearActiveFlow(state);
  state.startLocked = false;
  state.startLockedAt = null;
  syncMessageListener(state);
  publishSnapshot(state, createSnapshot());
}

export function isFlowOwner(instanceId: string, flowId?: string | null): boolean {
  const snapshot = getFlowSnapshot();
  if (snapshot.ownerInstanceId !== instanceId) return false;
  if (flowId && snapshot.activeFlowId && snapshot.activeFlowId !== flowId) return false;
  return true;
}

export function clearConsumedCallbackState(callbackState: string): void {
  const state = getState();
  state.consumedStates.delete(callbackState);
}
