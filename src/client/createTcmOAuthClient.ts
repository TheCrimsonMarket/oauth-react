import { createError, normalizeProviderError } from '../internal/errors';
import {
  clearRedirectResult,
  clearRedirectTransaction,
} from '../internal/redirect';
import {
  activatePopupFlow,
  claimFlowTransaction,
  clearConsumedCallbackState,
  finishPopupFlow,
  focusActivePopup,
  getFlowSnapshot,
  releaseFlowStartSlot,
  resetSharedFlowState,
  setFlowError,
  setFlowExchanging,
  setPreparingFlow,
  subscribeFlowSnapshot,
  tryAcquireFlowStartSlot,
} from '../internal/flowCoordinator';
import { createPkcePair, createState } from '../internal/pkce';
import { openPopup } from '../internal/popup';
import { SUPPORTED_PROVIDERS, isSupportedProvider } from '../internal/providers';
import { clearTransaction, consumeTransaction, saveTransaction } from '../internal/transaction';
import { buildAuthorizeUrl } from '../internal/url';
import { resolveTcmOAuthProvider, resolveTcmOAuthScope } from './policy';
import type { TcmAuthCodePayload, TcmOAuthError, TcmOAuthPhase, TcmProvider } from '../types';
import type {
  CreateTcmOAuthClientOptions,
  TcmOAuthClient,
  TcmOAuthClientPhase,
  TcmOAuthClientSnapshot,
  TcmOAuthPopupLoginParams,
} from './types';

const DEFAULT_CALLBACK_PATH = '/auth/tcm/popup-callback';
const DEFAULT_POPUP_SIZE = { width: 500, height: 650 };
const TXN_TTL_MS = 10 * 60 * 1000;
const IN_PROGRESS_MSG = 'OAuth popup flow already in progress.';

type SharedClientState = {
  inFlightLoginPromise: Promise<TcmAuthCodePayload> | null;
};

type ClientWindow = Window & {
  __tcmOauthClientState?: SharedClientState;
};

function createInstanceId(): string {
  return `tcm_client_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function createMessageId(): string {
  return `tcm_msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getSharedClientState(): SharedClientState {
  const clientWindow = window as ClientWindow;
  if (!clientWindow.__tcmOauthClientState) {
    clientWindow.__tcmOauthClientState = { inFlightLoginPromise: null };
  }
  return clientWindow.__tcmOauthClientState;
}

function resolveRequestedProvider(requestedProvider: TcmProvider | undefined, googleOnly: boolean | undefined): TcmProvider | undefined {
  if (!googleOnly) {
    return requestedProvider;
  }

  if (!requestedProvider) {
    return 'google';
  }

  if (requestedProvider !== 'google') {
    throw createError('config_error', 'googleOnly mode only supports the Google provider.', requestedProvider);
  }

  return requestedProvider;
}

export function resetTcmOAuthBrowserStateInternal(): void {
  if (typeof window === 'undefined') {
    return;
  }

  resetSharedFlowState();
  clearTransaction();
  clearRedirectTransaction();
  clearRedirectResult();
  getSharedClientState().inFlightLoginPromise = null;
}

function toRedirectUri(callbackPath: string): string {
  return new URL(callbackPath, window.location.origin).toString();
}

function toClientPhase(phase: TcmOAuthPhase): TcmOAuthClientPhase {
  if (phase === 'exchanging_partner') return 'awaiting_code_exchange';
  return phase;
}

function snapshotsMatch(a: TcmOAuthClientSnapshot | null, b: TcmOAuthClientSnapshot): boolean {
  if (!a) return false;
  return (
    a.phase === b.phase &&
    a.error === b.error &&
    a.activeProvider === b.activeProvider &&
    a.flowId === b.flowId &&
    a.authenticating === b.authenticating
  );
}

function createSnapshotReader(): () => TcmOAuthClientSnapshot {
  let cachedSnapshot: TcmOAuthClientSnapshot | null = null;

  return () => {
    const snapshot = getFlowSnapshot();
    const nextSnapshot: TcmOAuthClientSnapshot = {
      phase: toClientPhase(snapshot.phase),
      error: snapshot.error,
      activeProvider: snapshot.activeProvider,
      flowId: snapshot.activeFlowId,
      authenticating: snapshot.authenticating,
    };

    if (snapshotsMatch(cachedSnapshot, nextSnapshot)) {
      return cachedSnapshot as TcmOAuthClientSnapshot;
    }

    cachedSnapshot = nextSnapshot;
    return nextSnapshot;
  };
}

function validateRuntime(options: CreateTcmOAuthClientOptions): TcmOAuthError | null {
  if (!window.crypto?.subtle || !window.sessionStorage || typeof window.open !== 'function') {
    return createError('unsupported_browser', 'Browser does not support required OAuth popup APIs.');
  }

  if (!options.clientId || !options.tcmWebUrl) {
    return createError('config_error', 'Missing required SDK config: clientId or tcmWebUrl.');
  }

  return null;
}

export function createTcmOAuthClient(options: CreateTcmOAuthClientOptions): TcmOAuthClient {
  const callbackPath = options.callbackPath ?? DEFAULT_CALLBACK_PATH;
  const popupSize = {
    width: options.popup?.width ?? DEFAULT_POPUP_SIZE.width,
    height: options.popup?.height ?? DEFAULT_POPUP_SIZE.height,
  };
  const getSnapshot = createSnapshotReader();

  const ownerInstanceId = createInstanceId();

  async function loginWithPopup(params: TcmOAuthPopupLoginParams): Promise<TcmAuthCodePayload> {
    const requestedProvider = resolveRequestedProvider(params.provider, options.googleOnly);
    const sharedState = getSharedClientState();

    const runtimeError = validateRuntime(options);
    if (runtimeError) {
      setFlowError(runtimeError, { ownerInstanceId });
      throw runtimeError;
    }

    if (requestedProvider && !isSupportedProvider(String(requestedProvider))) {
      const error = createError(
        'config_error',
        `Unsupported provider: ${String(requestedProvider)}. Supported providers: ${SUPPORTED_PROVIDERS.join(', ')}`,
      );
      setFlowError(error, { ownerInstanceId });
      throw error;
    }

      const effectiveScope = await resolveTcmOAuthScope({
        clientId: options.clientId,
        tcmWebUrl: options.tcmWebUrl,
        requestedScope: options.scope,
        fetchImpl: options.fetch,
      });
      const effectiveProvider = requestedProvider
        ? await resolveTcmOAuthProvider({
            clientId: options.clientId,
            tcmWebUrl: options.tcmWebUrl,
            requestedProvider,
            fetchImpl: options.fetch,
          })
        : undefined;

      const slot = tryAcquireFlowStartSlot();
    if (!slot.acquired) {
      if (!slot.focusedExistingPopup) {
        focusActivePopup();
      }
      if (sharedState.inFlightLoginPromise) {
        return sharedState.inFlightLoginPromise;
      }
      throw createError('unknown_error', IN_PROGRESS_MSG, effectiveProvider);
    }

    setPreparingFlow(ownerInstanceId, effectiveProvider ?? null);

    const loginPromise = new Promise<TcmAuthCodePayload>((resolve, reject) => {
      let flowId: string | null = null;
      let settled = false;
      let popup: Window | null = null;

      const rejectFlow = (error: TcmOAuthError, finalize = true) => {
        if (settled) return;
        settled = true;
        if (flowId && finalize) {
          finishPopupFlow(flowId);
        }
        setFlowError(error, {
          flowId,
          ownerInstanceId,
        });
        reject(error);
      };

      const resolveFlow = (payload: TcmAuthCodePayload) => {
        if (settled) return;
        settled = true;
        resolve(payload);
      };

      void (async () => {
        try {
          const redirectUri = toRedirectUri(callbackPath);
          popup = openPopup('', popupSize);
          if (!popup) {
            releaseFlowStartSlot();
            clearTransaction();
            rejectFlow(createError('popup_blocked', 'Popup blocked by browser.', effectiveProvider), false);
            return;
          }

          const { codeVerifier, codeChallenge } = await createPkcePair();
          const state = createState();
          const now = Date.now();

          clearTransaction();
          clearConsumedCallbackState(state);

          saveTransaction({
            state,
            codeVerifier,
            redirectUri,
            provider: effectiveProvider,
            createdAt: now,
            expiresAt: now + TXN_TTL_MS,
            tcmWebUrl: options.tcmWebUrl,
          });

          const authUrl = buildAuthorizeUrl({
            tcmWebUrl: options.tcmWebUrl,
            clientId: options.clientId,
            redirectUri,
            scope: effectiveScope,
            state,
            codeChallenge,
            provider: effectiveProvider,
            googleOnly: options.googleOnly,
            interactionMode: 'popup',
          });

          popup.location.href = authUrl;

          flowId = activatePopupFlow({
            popup,
            expectedOrigin: window.location.origin,
            provider: effectiveProvider,
            ownerInstanceId,
            onPopupClosed: () => {
              clearTransaction();
              rejectFlow(createError('popup_closed', 'Popup was closed before completing login.', effectiveProvider));
            },
            onPopupResult: async (result) => {
              if (!flowId || !claimFlowTransaction(flowId)) return;

              const txn = consumeTransaction();
              if (!txn) {
                rejectFlow(createError('txn_missing', 'OAuth transaction not found.', effectiveProvider));
                return;
              }

              if (Date.now() > txn.expiresAt) {
                rejectFlow(createError('txn_expired', 'OAuth transaction expired.', effectiveProvider));
                return;
              }

              if ((result.state || '') !== txn.state) {
                rejectFlow(createError('state_mismatch', 'OAuth state mismatch detected.', effectiveProvider));
                return;
              }

              if (!result.ok) {
                rejectFlow(normalizeProviderError(result.error, result.error_description));
                return;
              }

              setFlowExchanging(flowId);
              finishPopupFlow(flowId);
              resolveFlow({
                code: result.code,
                state: txn.state,
                codeVerifier: txn.codeVerifier,
                redirectUri: txn.redirectUri,
                provider: txn.provider,
                _tcmFlowId: flowId,
                _tcmMessageId: createMessageId(),
              });
            },
          });
        } catch (cause) {
          releaseFlowStartSlot();
          clearTransaction();
          if (popup && !popup.closed) {
            try {
              popup.close();
            } catch {
              // noop
            }
          }
          rejectFlow(createError('unknown_error', 'Failed to start OAuth popup flow.', requestedProvider, cause), false);
        }
      })();
    });

    sharedState.inFlightLoginPromise = loginPromise;

    return loginPromise.finally(() => {
      if (sharedState.inFlightLoginPromise === loginPromise) {
        sharedState.inFlightLoginPromise = null;
      }
    });
  }

  return {
    loginWithPopup,
    clearError: () => {
      resetTcmOAuthBrowserStateInternal();
    },
    subscribe: (listener: () => void) => subscribeFlowSnapshot(listener),
    getSnapshot,
    focusActivePopup: () => focusActivePopup(),
  };
}
