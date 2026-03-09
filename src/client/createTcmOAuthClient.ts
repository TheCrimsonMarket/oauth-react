import { createError, normalizeProviderError } from '../internal/errors';
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
import type { TcmAuthCodePayload, TcmOAuthError, TcmOAuthPhase, TcmProvider } from '../types';
import type {
  CreateTcmOAuthClientOptions,
  TcmOAuthClient,
  TcmOAuthClientPhase,
  TcmOAuthClientSnapshot,
  TcmOAuthPopupLoginParams,
} from './types';

const DEFAULT_SCOPE = 'profile email';
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

function toRedirectUri(callbackPath: string): string {
  return new URL(callbackPath, window.location.origin).toString();
}

function toClientPhase(phase: TcmOAuthPhase): TcmOAuthClientPhase {
  if (phase === 'exchanging_partner') return 'awaiting_code_exchange';
  return phase;
}

function toClientSnapshot(): TcmOAuthClientSnapshot {
  const snapshot = getFlowSnapshot();
  return {
    phase: toClientPhase(snapshot.phase),
    error: snapshot.error,
    activeProvider: snapshot.activeProvider,
    flowId: snapshot.activeFlowId,
    authenticating: snapshot.authenticating,
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
  const scope = options.scope ?? DEFAULT_SCOPE;
  const popupSize = {
    width: options.popup?.width ?? DEFAULT_POPUP_SIZE.width,
    height: options.popup?.height ?? DEFAULT_POPUP_SIZE.height,
  };

  const ownerInstanceId = createInstanceId();

  async function loginWithPopup(params: TcmOAuthPopupLoginParams): Promise<TcmAuthCodePayload> {
    const provider = params.provider;
    const sharedState = getSharedClientState();

    const runtimeError = validateRuntime(options);
    if (runtimeError) {
      setFlowError(runtimeError, { ownerInstanceId });
      throw runtimeError;
    }

    if (!isSupportedProvider(String(provider))) {
      const error = createError(
        'config_error',
        `Unsupported provider: ${String(provider)}. Supported providers: ${SUPPORTED_PROVIDERS.join(', ')}`,
      );
      setFlowError(error, { ownerInstanceId });
      throw error;
    }

    const slot = tryAcquireFlowStartSlot();
    if (!slot.acquired) {
      if (!slot.focusedExistingPopup) {
        focusActivePopup();
      }
      if (sharedState.inFlightLoginPromise) {
        return sharedState.inFlightLoginPromise;
      }
      throw createError('unknown_error', IN_PROGRESS_MSG, provider);
    }

    setPreparingFlow(ownerInstanceId, provider);

    const loginPromise = new Promise<TcmAuthCodePayload>((resolve, reject) => {
      let flowId: string | null = null;
      let settled = false;

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
          const { codeVerifier, codeChallenge } = await createPkcePair();
          const state = createState();
          const now = Date.now();

          clearTransaction();
          clearConsumedCallbackState(state);

          saveTransaction({
            state,
            codeVerifier,
            redirectUri,
            provider,
            createdAt: now,
            expiresAt: now + TXN_TTL_MS,
            tcmWebUrl: options.tcmWebUrl,
          });

          const authUrl = buildAuthorizeUrl({
            tcmWebUrl: options.tcmWebUrl,
            clientId: options.clientId,
            redirectUri,
            scope,
            state,
            codeChallenge,
            provider,
          });

          const popup = openPopup(authUrl, popupSize);
          if (!popup) {
            releaseFlowStartSlot();
            clearTransaction();
            rejectFlow(createError('popup_blocked', 'Popup blocked by browser.', provider), false);
            return;
          }

          flowId = activatePopupFlow({
            popup,
            expectedOrigin: window.location.origin,
            provider,
            ownerInstanceId,
            onPopupClosed: () => {
              clearTransaction();
              rejectFlow(createError('popup_closed', 'Popup was closed before completing login.', provider));
            },
            onPopupResult: async (result) => {
              if (!flowId || !claimFlowTransaction(flowId)) return;

              const txn = consumeTransaction();
              if (!txn) {
                rejectFlow(createError('txn_missing', 'OAuth transaction not found.', provider));
                return;
              }

              if (Date.now() > txn.expiresAt) {
                rejectFlow(createError('txn_expired', 'OAuth transaction expired.', provider));
                return;
              }

              if ((result.state || '') !== txn.state) {
                rejectFlow(createError('state_mismatch', 'OAuth state mismatch detected.', provider));
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
          rejectFlow(createError('unknown_error', 'Failed to start OAuth popup flow.', provider, cause), false);
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
      resetSharedFlowState();
      getSharedClientState().inFlightLoginPromise = null;
    },
    subscribe: (listener: () => void) => subscribeFlowSnapshot(listener),
    getSnapshot: () => toClientSnapshot(),
    focusActivePopup: () => focusActivePopup(),
  };
}
