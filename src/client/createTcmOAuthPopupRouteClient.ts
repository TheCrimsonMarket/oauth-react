import { createTcmOAuthClient } from './createTcmOAuthClient';
import { exchangeCodeViaRoute } from './exchangeRoute';
import { createError } from '../internal/errors';
import { setFlowDone, setFlowError } from '../internal/flowCoordinator';
import type { TcmAuthCodePayload, TcmOAuthError } from '../types';
import type {
  CreateTcmOAuthPopupRouteClientOptions,
  TcmOAuthPopupLoginParams,
  TcmOAuthPopupRouteClient,
} from './types';

const DEFAULT_EXCHANGE_ENDPOINT = '/api/auth/tcm/oauth-exchange';

export function createTcmOAuthPopupRouteClient<TExchangeResult = unknown>(
  options: CreateTcmOAuthPopupRouteClientOptions<TExchangeResult>,
): TcmOAuthPopupRouteClient<TExchangeResult> {
  const client = createTcmOAuthClient(options);

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

  return {
    ...client,
    exchangeCodeViaRoute: exchangeCode,
    async loginWithPopupRoute(params: TcmOAuthPopupLoginParams) {
      const payload = await client.loginWithPopup(params);
      return exchangeCode(payload);
    },
  };
}
