import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createError } from '../internal/errors';
import { createTcmOAuthRouteClient } from '../client/createTcmOAuthRouteClient';
import type { TcmOAuthClientPhase } from '../client/types';
import type {
  TcmOAuthError,
  TcmOAuthPhase,
  TcmProvider,
  TcmResolvedOAuthInteractionMode,
  UseTcmOAuthOptions,
  UseTcmOAuthReturn,
} from '../types';

function toHookPhase(phase: TcmOAuthClientPhase): TcmOAuthPhase {
  if (phase === 'awaiting_code_exchange') return 'exchanging_partner';
  return phase;
}

function normalizeCaughtError(cause: unknown): TcmOAuthError {
  if (cause && typeof cause === 'object' && 'code' in cause && 'message' in cause) {
    return cause as TcmOAuthError;
  }
  return createError('unknown_error', 'Failed to start OAuth flow.', undefined, cause);
}

function logNonFatalOnSuccessError(cause: unknown): void {
  const isDev = typeof process !== 'undefined' && process.env.NODE_ENV !== 'production';
  if (!isDev) return;
  console.warn('[tcm-oauth-sdk] onSuccess callback threw after successful exchange; preserving done state.', cause);
}

export function useTcmOAuth<TExchangeResult = unknown>(
  options: UseTcmOAuthOptions<TExchangeResult>,
): UseTcmOAuthReturn<TExchangeResult> {
  const popupWidth = options.popup?.width;
  const popupHeight = options.popup?.height;
  const client = useMemo(
    () =>
      createTcmOAuthRouteClient<TExchangeResult>({
        clientId: options.clientId,
        tcmWebUrl: options.tcmWebUrl,
        callbackPath: options.callbackPath,
        scope: options.scope,
        popup: options.popup,
        exchangeEndpoint: options.exchangeEndpoint,
        diagnostics: options.diagnostics,
        fetch: options.fetch,
        interactionMode: options.interactionMode,
        fallbackToRedirect: options.fallbackToRedirect,
        returnTo: options.returnTo,
      }),
    [
      options.callbackPath,
      options.clientId,
      options.diagnostics,
      options.exchangeEndpoint,
      options.fetch,
      options.fallbackToRedirect,
      options.interactionMode,
      popupHeight,
      popupWidth,
      options.returnTo,
      options.scope,
      options.tcmWebUrl,
    ],
  );

  const snapshot = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  const [redirectResumeState, setRedirectResumeState] = useState<{
    active: boolean;
    phase: TcmOAuthPhase;
    error: TcmOAuthError | null;
  }>({
    active: false,
    phase: toHookPhase(snapshot.phase),
    error: null,
  });
  const [resolvedInteractionMode, setResolvedInteractionMode] = useState<TcmResolvedOAuthInteractionMode | null>(null);

  const onSuccessRef = useRef(options.onSuccess);
  const onErrorRef = useRef(options.onError);
  const resumedRef = useRef(false);

  useEffect(() => {
    onSuccessRef.current = options.onSuccess;
  }, [options.onSuccess]);

  useEffect(() => {
    onErrorRef.current = options.onError;
  }, [options.onError]);

  useEffect(() => {
    if (resumedRef.current) return;
    resumedRef.current = true;

    let cancelled = false;
    void (async () => {
      if (!client.hasPendingRedirectResult()) {
        return;
      }
      try {
        setRedirectResumeState({
          active: true,
          phase: 'exchanging_partner',
          error: null,
        });
        const result = await client.resumeRedirectRouteIfPresent();
        if (cancelled || result === null) {
          setRedirectResumeState({
            active: false,
            phase: toHookPhase(snapshot.phase),
            error: snapshot.error,
          });
          return;
        }

        setResolvedInteractionMode('redirect');
        try {
          await onSuccessRef.current?.(result);
        } catch (cause) {
          logNonFatalOnSuccessError(cause);
        }
        if (!cancelled) {
          setRedirectResumeState({
            active: false,
            phase: 'done',
            error: null,
          });
        }
      } catch (cause) {
        const nextError = normalizeCaughtError(cause);
        if (!cancelled) {
          setRedirectResumeState({
            active: false,
            phase: 'error',
            error: nextError,
          });
        }
        onErrorRef.current?.(nextError);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, snapshot.error, snapshot.phase]);

  const startLogin = useCallback(
    async (provider: TcmProvider) => {
      const mode = client.resolveInteractionMode();
      setResolvedInteractionMode(mode);
      setRedirectResumeState({
        active: false,
        phase: toHookPhase(snapshot.phase),
        error: null,
      });

      let exchangeResult;
      try {
        exchangeResult = await client.loginWithRoute({ provider });
      } catch (cause) {
        const nextError = normalizeCaughtError(cause);
        onErrorRef.current?.(nextError);
        return;
      }

      if (mode === 'redirect') {
        return;
      }

      try {
        await onSuccessRef.current?.(exchangeResult);
      } catch (cause) {
        logNonFatalOnSuccessError(cause);
      }
    },
    [client, snapshot.phase],
  );

  const phase = redirectResumeState.active ? redirectResumeState.phase : toHookPhase(snapshot.phase);
  const error = redirectResumeState.active ? redirectResumeState.error : redirectResumeState.phase === 'error'
    ? redirectResumeState.error
    : snapshot.error;
  const authenticating = redirectResumeState.active ? true : snapshot.authenticating;

  return useMemo(
    () => ({
      authenticating,
      phase,
      error,
      resolvedInteractionMode,
      startLogin,
      clearError: client.clearError,
    }),
    [authenticating, client.clearError, error, phase, resolvedInteractionMode, startLogin],
  );
}
