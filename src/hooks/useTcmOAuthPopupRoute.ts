import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { createError } from '../internal/errors';
import type { TcmOAuthClientPhase } from '../client/types';
import { createTcmOAuthPopupRouteClient } from '../client/createTcmOAuthPopupRouteClient';
import type { TcmOAuthError, TcmOAuthPhase, TcmProvider } from '../types';
import type { UseTcmOAuthPopupRouteOptions, UseTcmOAuthPopupRouteReturn } from '../types';

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

export function useTcmOAuthPopupRoute<TExchangeResult = unknown>(
  options: UseTcmOAuthPopupRouteOptions<TExchangeResult>,
): UseTcmOAuthPopupRouteReturn<TExchangeResult> {
  const popupWidth = options.popup?.width;
  const popupHeight = options.popup?.height;

  const client = useMemo(
    () =>
      createTcmOAuthPopupRouteClient<TExchangeResult>({
        clientId: options.clientId,
        tcmWebUrl: options.tcmWebUrl,
        callbackPath: options.callbackPath,
        scope: options.scope,
        googleOnly: options.googleOnly,
        popup: options.popup,
        exchangeEndpoint: options.exchangeEndpoint,
        diagnostics: options.diagnostics,
        fetch: options.fetch,
      }),
    [
      options.callbackPath,
      options.clientId,
      options.diagnostics,
      options.exchangeEndpoint,
      options.fetch,
      options.googleOnly,
      popupHeight,
      popupWidth,
      options.scope,
      options.tcmWebUrl,
    ],
  );

  const snapshot = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  const phase = toHookPhase(snapshot.phase);
  const error = snapshot.error;
  const authenticating = snapshot.authenticating;

  const onSuccessRef = useRef(options.onSuccess);
  const onErrorRef = useRef(options.onError);

  useEffect(() => {
    onSuccessRef.current = options.onSuccess;
  }, [options.onSuccess]);

  useEffect(() => {
    onErrorRef.current = options.onError;
  }, [options.onError]);

  const startLogin = useCallback(
    async (provider?: TcmProvider) => {
      let exchangeResult;

      try {
        exchangeResult = await client.loginWithPopupRoute({ provider });
      } catch (cause) {
        const nextError = normalizeCaughtError(cause);
        onErrorRef.current?.(nextError);
        return;
      }

      try {
        await onSuccessRef.current?.(exchangeResult);
      } catch (cause) {
        logNonFatalOnSuccessError(cause);
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
