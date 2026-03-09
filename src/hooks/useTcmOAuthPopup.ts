import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { createError } from '../internal/errors';
import { setFlowDone, setFlowError } from '../internal/flowCoordinator';
import { createTcmOAuthClient } from '../client/createTcmOAuthClient';
import type { TcmOAuthClientPhase } from '../client/types';
import type { TcmOAuthError, TcmOAuthPhase, TcmProvider, UseTcmOAuthPopupOptions, UseTcmOAuthPopupReturn } from '../types';

function toHookPhase(phase: TcmOAuthClientPhase): TcmOAuthPhase {
  if (phase === 'awaiting_code_exchange') return 'exchanging_partner';
  return phase;
}

function logNonFatalOnSuccessError(cause: unknown): void {
  const isDev = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
  if (!isDev) return;
  console.warn('[tcm-oauth-sdk] onSuccess callback threw after successful exchange; preserving done state.', cause);
}

function normalizeCaughtError(cause: unknown): TcmOAuthError {
  if (cause && typeof cause === 'object' && 'code' in cause && 'message' in cause) {
    return cause as TcmOAuthError;
  }
  return createError('unknown_error', 'Failed to start OAuth popup flow.', undefined, cause);
}

export function useTcmOAuthPopup<TExchangeResult = unknown>(
  options: UseTcmOAuthPopupOptions<TExchangeResult>,
): UseTcmOAuthPopupReturn<TExchangeResult> {
  const popupWidth = options.popup?.width;
  const popupHeight = options.popup?.height;

  const client = useMemo(
    () => createTcmOAuthClient({
      clientId: options.clientId,
      tcmWebUrl: options.tcmWebUrl,
      callbackPath: options.callbackPath,
      scope: options.scope,
      popup: options.popup,
    }),
    [options.callbackPath, options.clientId, popupHeight, popupWidth, options.scope, options.tcmWebUrl],
  );

  const snapshot = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  const phase = toHookPhase(snapshot.phase);
  const error = snapshot.error;
  const authenticating = snapshot.authenticating;

  const startLogin = useCallback(
    async (provider: TcmProvider) => {
      let payload;
      try {
        payload = await client.loginWithPopup({ provider });
      } catch (cause) {
        const nextError = normalizeCaughtError(cause);
        options.onError?.(nextError);
        return;
      }

      try {
        const exchangeResult = await options.exchangeCode(payload);
        setFlowDone(payload._tcmFlowId ?? null);
        try {
          await options.onSuccess?.(exchangeResult);
        } catch (cause) {
          logNonFatalOnSuccessError(cause);
        }
      } catch (cause) {
        const nextError = createError('exchange_failed', 'Partner code exchange failed.', provider, cause);
        setFlowError(nextError, {
          flowId: payload._tcmFlowId ?? null,
        });
        options.onError?.(nextError);
      }
    },
    [client, options],
  );

  return useMemo(
    () => ({
      authenticating,
      phase,
      error,
      startLogin,
      clearError: client.clearError,
    }),
    [authenticating, client.clearError, error, phase, startLogin],
  );
}
