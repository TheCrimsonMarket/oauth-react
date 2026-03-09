import { createTcmOAuthClient } from './createTcmOAuthClient';
import { exchangeCodeViaRoute } from './exchangeRoute';
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

  const exchangeCode = (payload: Parameters<typeof exchangeCodeViaRoute<TExchangeResult>>[0]) =>
    exchangeCodeViaRoute<TExchangeResult>(payload, {
      exchangeEndpoint: options.exchangeEndpoint ?? DEFAULT_EXCHANGE_ENDPOINT,
      diagnostics: options.diagnostics ?? 'auto',
      fetchImpl: options.fetch,
    });

  return {
    ...client,
    exchangeCodeViaRoute: exchangeCode,
    async loginWithPopupRoute(params: TcmOAuthPopupLoginParams) {
      const payload = await client.loginWithPopup(params);
      return exchangeCode(payload);
    },
  };
}
