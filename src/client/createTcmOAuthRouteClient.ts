import { createTcmOAuthPopupRouteClient } from './createTcmOAuthPopupRouteClient';
import { exchangeCodeViaRoute } from './exchangeRoute';
import { resolveInteractionMode } from '../internal/interaction';
import { hasPendingRedirectResult, resumeRedirectPayloadIfPresent, startRedirectLogin } from '../internal/redirect';
import type {
  CreateTcmOAuthRouteClientOptions,
  TcmOAuthPopupLoginParams,
  TcmOAuthRouteClient,
} from './types';

const DEFAULT_CALLBACK_PATH = '/auth/tcm/callback';
const DEFAULT_EXCHANGE_ENDPOINT = '/api/auth/tcm/oauth-exchange';
const DEFAULT_SCOPE = 'profile email';

export function createTcmOAuthRouteClient<TExchangeResult = unknown>(
  options: CreateTcmOAuthRouteClientOptions<TExchangeResult>,
): TcmOAuthRouteClient<TExchangeResult> {
  const popupClient = createTcmOAuthPopupRouteClient<TExchangeResult>({
    ...options,
    callbackPath: options.callbackPath ?? DEFAULT_CALLBACK_PATH,
  });

  const exchangeCode = (payload: Parameters<typeof exchangeCodeViaRoute<TExchangeResult>>[0]) =>
    exchangeCodeViaRoute<TExchangeResult>(payload, {
      exchangeEndpoint: options.exchangeEndpoint ?? DEFAULT_EXCHANGE_ENDPOINT,
      diagnostics: options.diagnostics ?? 'auto',
      fetchImpl: options.fetch,
    });

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
            await startRedirectLogin({
              clientId: options.clientId,
              tcmWebUrl: options.tcmWebUrl,
              callbackPath: options.callbackPath ?? DEFAULT_CALLBACK_PATH,
              scope: options.scope ?? DEFAULT_SCOPE,
              provider: params.provider,
              returnTo: options.returnTo,
            });
          }
          throw error;
        }
      }

      return startRedirectLogin({
        clientId: options.clientId,
        tcmWebUrl: options.tcmWebUrl,
        callbackPath: options.callbackPath ?? DEFAULT_CALLBACK_PATH,
        scope: options.scope ?? DEFAULT_SCOPE,
        provider: params.provider,
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
