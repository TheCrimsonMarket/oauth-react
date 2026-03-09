import { exchangeTcmPopupCode, toSingleFlightKey } from '../server/exchange';
import type { TcmAuthCodePayload } from '../types';
import type { CreateTcmOAuthExchangeRouteOptions, TcmOAuthCorrelationContext } from '../server/types';
import { TcmOAuthServerError, isTcmOAuthServerError } from '../server/types';

const CORRELATION_HEADER_MAX_LENGTH = 128;

function shouldIncludeDiagnostics(mode: 'auto' | 'always' | 'never' = 'auto'): boolean {
  if (mode === 'always') return true;
  if (mode === 'never') return false;

  const appEnv = (process.env.NEXT_PUBLIC_APP_ENV || process.env.APP_ENV || '').toLowerCase();
  return process.env.NODE_ENV !== 'production' || appEnv === 'staging';
}

function toSafeCorrelationValue(value: string | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > CORRELATION_HEADER_MAX_LENGTH) return null;
  if (!/^[a-zA-Z0-9._:-]+$/.test(trimmed)) return null;
  return trimmed;
}

function readCorrelationContext(req: Request, mode: 'auto' | 'always' | 'never' = 'auto'): TcmOAuthCorrelationContext {
  const enabled = shouldIncludeDiagnostics(mode);
  if (!enabled) {
    return {
      enabled: false,
      flowId: null,
      messageId: null,
    };
  }

  return {
    enabled: true,
    flowId: toSafeCorrelationValue(req.headers.get('x-tcm-flow-id')),
    messageId: toSafeCorrelationValue(req.headers.get('x-tcm-message-id')),
  };
}

function applyCorrelationHeaders(headers: Headers, correlation: TcmOAuthCorrelationContext): void {
  if (!correlation.enabled) return;
  if (correlation.flowId) headers.set('x-tcm-flow-id', correlation.flowId);
  if (correlation.messageId) headers.set('x-tcm-message-id', correlation.messageId);
}

function buildJsonResponse(body: unknown, status: number, correlation: TcmOAuthCorrelationContext, headersInit?: HeadersInit): Response {
  const headers = new Headers(headersInit);
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  applyCorrelationHeaders(headers, correlation);
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

function buildErrorBody(error: TcmOAuthServerError) {
  return {
    message: error.message,
    ...(error.code ? { error: error.code } : {}),
    ...(error.traceId ? { traceId: error.traceId } : {}),
  };
}

export function createTcmOAuthExchangeRoute<TSession = unknown, TBody = unknown>(
  options: CreateTcmOAuthExchangeRouteOptions<TSession, TBody>,
): { POST: (req: Request) => Promise<Response> } {
  const inFlightExchangeRequests = new Map<
    string,
    Promise<{
      body: TBody;
      session?: TSession;
      status: number;
      headers?: HeadersInit;
      traceId: string;
    }>
  >();

  return {
    async POST(req: Request): Promise<Response> {
      const correlation = readCorrelationContext(req, options.diagnostics);

      try {
        const payload = (await req.json()) as {
          code?: string;
          state?: string;
          codeVerifier?: string;
          redirectUri?: string;
          provider?: TcmAuthCodePayload['provider'];
          _tcmFlowId?: string;
          _tcmMessageId?: string;
        };

        const normalizedPayload = {
          code: payload.code || '',
          state: payload.state || '',
          codeVerifier: payload.codeVerifier || '',
          redirectUri: payload.redirectUri || '',
          provider: payload.provider || 'google',
          _tcmFlowId: payload._tcmFlowId,
          _tcmMessageId: payload._tcmMessageId,
        };

        const singleFlightKey = toSingleFlightKey(normalizedPayload);
        const inFlight = inFlightExchangeRequests.get(singleFlightKey);
        if (inFlight) {
          const settled = await inFlight;
          const response = buildJsonResponse(settled.body, settled.status, correlation, settled.headers);
          if (settled.session && options.applySession) {
            await options.applySession(response, settled.session, {
              request: req,
              traceId: settled.traceId,
              correlation,
            });
          }
          return response;
        }

        const executionPromise = (async () => {
          const exchangeResult = await exchangeTcmPopupCode(normalizedPayload, {
            ...options.oauth,
            requestUrl: req.url,
          });

          const resolved = await options.onResolvedUser({
            userInfo: exchangeResult.userInfo,
            tokenSet: exchangeResult.tokenSet,
            request: req,
            traceId: exchangeResult.traceId,
            correlation,
            redirectUri: exchangeResult.redirectUri,
            provider: exchangeResult.provider,
            payload: normalizedPayload,
          });

          return {
            body: resolved.body,
            session: resolved.session,
            status: resolved.status ?? 200,
            headers: resolved.headers,
            traceId: exchangeResult.traceId,
          };
        })();

        inFlightExchangeRequests.set(singleFlightKey, executionPromise);

        let settled;
        try {
          settled = await executionPromise;
        } finally {
          if (inFlightExchangeRequests.get(singleFlightKey) === executionPromise) {
            inFlightExchangeRequests.delete(singleFlightKey);
          }
        }

        const response = buildJsonResponse(settled.body, settled.status, correlation, settled.headers);
        if (settled.session && options.applySession) {
          await options.applySession(response, settled.session, {
            request: req,
            traceId: settled.traceId,
            correlation,
          });
        }
        return response;
      } catch (error) {
        const normalizedError = isTcmOAuthServerError(error)
          ? error
          : new TcmOAuthServerError(
              error instanceof Error ? error.message : 'TCM OAuth exchange failed',
              500,
            );

        return buildJsonResponse(buildErrorBody(normalizedError), normalizedError.status, correlation);
      }
    },
  };
}
