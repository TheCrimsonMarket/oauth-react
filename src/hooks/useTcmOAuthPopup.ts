import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
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

  // Keep handlers current without forcing startLogin identity churn each render.
  const exchangeCodeRef = useRef(options.exchangeCode);
  const onSuccessRef = useRef(options.onSuccess);
  const onErrorRef = useRef(options.onError);

  useEffect(() => {
    exchangeCodeRef.current = options.exchangeCode;
  }, [options.exchangeCode]);

  useEffect(() => {
    onSuccessRef.current = options.onSuccess;
  }, [options.onSuccess]);

  useEffect(() => {
    onErrorRef.current = options.onError;
  }, [options.onError]);

  const startLogin = useCallback(
    async (provider: TcmProvider) => {
      let payload;
      try {
        payload = await client.loginWithPopup({ provider });
      } catch (cause) {
        const nextError = normalizeCaughtError(cause);
        onErrorRef.current?.(nextError);
        return;
      }

      try {
        const exchangeResult = await exchangeCodeRef.current(payload);
        setFlowDone(payload._tcmFlowId ?? null);
        try {
          await onSuccessRef.current?.(exchangeResult);
        } catch (cause) {
          logNonFatalOnSuccessError(cause);
        }
      } catch (cause) {
        const nextError = createError('exchange_failed', 'Partner code exchange failed.', provider, cause);
        setFlowError(nextError, {
          flowId: payload._tcmFlowId ?? null,
        });
        onErrorRef.current?.(nextError);
      }
    },
    [client],
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
