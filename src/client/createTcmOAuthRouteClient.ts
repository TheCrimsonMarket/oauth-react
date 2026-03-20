import { createTcmOAuthPopupRouteClient } from './createTcmOAuthPopupRouteClient';
import { exchangeCodeViaRoute } from './exchangeRoute';
import { createError } from '../internal/errors';
import { setFlowDone, setFlowError } from '../internal/flowCoordinator';
import { resolveTcmOAuthProvider, resolveTcmOAuthScope } from './policy';
import { resolveInteractionMode } from '../internal/interaction';
import { hasPendingRedirectResult, resumeRedirectPayloadIfPresent, startRedirectLogin } from '../internal/redirect';
import type { TcmAuthCodePayload, TcmOAuthError } from '../types';
import type {
  CreateTcmOAuthRouteClientOptions,
  TcmOAuthPopupLoginParams,
  TcmOAuthRouteClient,
} from './types';

const DEFAULT_CALLBACK_PATH = '/auth/tcm/callback';
const DEFAULT_EXCHANGE_ENDPOINT = '/api/auth/tcm/oauth-exchange';
export function createTcmOAuthRouteClient<TExchangeResult = unknown>(
  options: CreateTcmOAuthRouteClientOptions<TExchangeResult>,
): TcmOAuthRouteClient<TExchangeResult> {
  const popupClient = createTcmOAuthPopupRouteClient<TExchangeResult>({
    ...options,
    callbackPath: options.callbackPath ?? DEFAULT_CALLBACK_PATH,
  });

  const finalizeExchangeError = (payload: TcmAuthCodePayload, cause: unknown): TcmOAuthError => {
    if (cause && typeof cause === 'object' && 'code' in cause && 'message' in cause) {
      return cause as TcmOAuthError;
    }
    return createError('unknown_error', 'OAuth route exchange failed.', payload.provider, cause);
  };

  const exchangeCode = async (payload: Parameters<typeof exchangeCodeViaRoute<TExchangeResult>>[0]) => {
    try {
      const result = await exchangeCodeViaRoute<TExchangeResult>(payload, {
        exchangeEndpoint: options.exchangeEndpoint ?? DEFAULT_EXCHANGE_ENDPOINT,
        diagnostics: options.diagnostics ?? 'auto',
        fetchImpl: options.fetch,
      });
      setFlowDone(payload._tcmFlowId ?? null);
      return result;
    } catch (cause) {
      const error = finalizeExchangeError(payload, cause);
      setFlowError(error, { flowId: payload._tcmFlowId ?? null });
      throw error;
    }
  };

  const resolveMode = () => resolveInteractionMode(options.interactionMode);

  return {
    ...popupClient,
    resolveInteractionMode: resolveMode,
    hasPendingRedirectResult,
    async loginWithRoute(params: TcmOAuthPopupLoginParams) {
      const mode = resolveMode();
      if (mode === 'popup') {
        try {
          return await popupClient.loginWithPopupRoute(params);
        } catch (error) {
          const errorCode = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
          if (errorCode === 'popup_blocked' && options.fallbackToRedirect !== false) {
            const effectiveProvider = await resolveTcmOAuthProvider({
              clientId: options.clientId,
              tcmWebUrl: options.tcmWebUrl,
              requestedProvider: params.provider,
              fetchImpl: options.fetch,
            });
            const effectiveScope = await resolveTcmOAuthScope({
              clientId: options.clientId,
              tcmWebUrl: options.tcmWebUrl,
              requestedScope: options.scope,
              fetchImpl: options.fetch,
            });
            await startRedirectLogin({
              clientId: options.clientId,
              tcmWebUrl: options.tcmWebUrl,
              callbackPath: options.callbackPath ?? DEFAULT_CALLBACK_PATH,
              scope: effectiveScope,
              provider: effectiveProvider,
              returnTo: options.returnTo,
            });
          }
          throw error;
        }
      }

      const effectiveProvider = await resolveTcmOAuthProvider({
        clientId: options.clientId,
        tcmWebUrl: options.tcmWebUrl,
        requestedProvider: params.provider,
        fetchImpl: options.fetch,
      });
      const effectiveScope = await resolveTcmOAuthScope({
        clientId: options.clientId,
        tcmWebUrl: options.tcmWebUrl,
        requestedScope: options.scope,
        fetchImpl: options.fetch,
      });

      return startRedirectLogin({
        clientId: options.clientId,
        tcmWebUrl: options.tcmWebUrl,
        callbackPath: options.callbackPath ?? DEFAULT_CALLBACK_PATH,
        scope: effectiveScope,
        provider: effectiveProvider,
        returnTo: options.returnTo,
      });
    },
    async resumeRedirectRouteIfPresent() {
      const payload = resumeRedirectPayloadIfPresent();
      if (!payload) return null;
      return exchangeCode(payload);
    },
  };
}
