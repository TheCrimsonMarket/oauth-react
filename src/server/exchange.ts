import { createHash, randomUUID } from 'node:crypto';
import type { TcmAuthCodePayload } from '../types';
import { resolvePopupRedirectUri } from './redirect';
import type {
  ExchangeTcmAuthorizationCodeOptions,
  ExchangeTcmAuthorizationCodeResult,
  ExchangeTcmPopupCodeOptions,
  TcmOAuthExchangeResult,
  TcmOAuthServerOptions,
  TcmOAuthTokenSet,
  TcmOAuthUserInfo,
} from './types';
import { TcmOAuthServerError } from './types';

function createTraceId(): string {
  try {
    return randomUUID();
  } catch {
    return `tcm-oauth-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function getRequiredString(value: string | undefined, name: string): string {
  if (!value || typeof value !== 'string') {
    throw new TcmOAuthServerError(`Missing ${name}`, 500);
  }
  return value;
}

function isAbsoluteHttpUrl(value: string | undefined): boolean {
  if (!value || typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value || typeof value !== 'string' || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

function isRedirectUriMismatchError(errorPayload: Record<string, unknown> | null): boolean {
  if (!errorPayload) return false;
  const errorCode = String(errorPayload.error || '').toLowerCase();
  const description = String(errorPayload.error_description || '').toLowerCase();
  if (!description.includes('redirect uri does not match')) return false;
  return errorCode === 'invalid_grant' || errorCode === 'invalid_request';
}

async function parseJsonSafe(response: Response): Promise<Record<string, unknown> | null> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return null;
  }

  const parsed = await response.json().catch(() => null);
  if (!parsed || typeof parsed !== 'object') return null;
  return parsed as Record<string, unknown>;
}

function toTokenSet(payload: Record<string, unknown>): TcmOAuthTokenSet {
  const accessToken = getRequiredString(
    typeof payload.access_token === 'string' ? payload.access_token : undefined,
    'access_token',
  );

  return {
    accessToken,
    refreshToken: typeof payload.refresh_token === 'string' ? payload.refresh_token : undefined,
    expiresIn: typeof payload.expires_in === 'number' ? payload.expires_in : undefined,
    tokenType: typeof payload.token_type === 'string' ? payload.token_type : undefined,
    scope: typeof payload.scope === 'string' ? payload.scope : undefined,
    raw: payload,
  };
}

function resolveRedirectUriCandidates(payload: TcmAuthCodePayload, options: ExchangeTcmAuthorizationCodeOptions): string[] {
  const fallbackRedirectUri =
    options.requestUrl && resolvePopupRedirectUri({
      requestUrl: options.requestUrl,
      callbackPath: options.callbackPath,
      explicitRedirectUri: undefined,
    });

  return uniqueStrings([
    isAbsoluteHttpUrl(payload.redirectUri) ? payload.redirectUri : null,
    isAbsoluteHttpUrl(options.redirectUri) ? options.redirectUri : null,
    fallbackRedirectUri,
  ]);
}

function getFetchImpl(options: TcmOAuthServerOptions): typeof fetch {
  const fetchImpl = options.fetch ?? fetch;
  if (typeof fetchImpl !== 'function') {
    throw new TcmOAuthServerError('Global fetch is required for server-side OAuth exchange.', 500);
  }
  return fetchImpl;
}

export async function exchangeTcmAuthorizationCode(
  payload: TcmAuthCodePayload,
  options: ExchangeTcmAuthorizationCodeOptions,
): Promise<ExchangeTcmAuthorizationCodeResult> {
  if (!payload.code || !payload.state || !payload.codeVerifier) {
    throw new TcmOAuthServerError('code, state, and codeVerifier are required', 400);
  }

  const apiBaseUrl = getRequiredString(options.apiBaseUrl, 'apiBaseUrl').replace(/\/$/, '');
  const clientId = getRequiredString(options.clientId, 'clientId');
  const clientSecret = getRequiredString(options.clientSecret, 'clientSecret');
  const fetchImpl = getFetchImpl(options);
  const traceId = options.traceId ?? createTraceId();
  const redirectUriCandidates = resolveRedirectUriCandidates(payload, options);

  if (redirectUriCandidates.length === 0) {
    throw new TcmOAuthServerError('Unable to resolve redirect_uri for token exchange', 500, { traceId });
  }

  const basicAuth = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;

  for (let index = 0; index < redirectUriCandidates.length; index += 1) {
    const redirectUri = redirectUriCandidates[index];
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: payload.code,
      redirect_uri: redirectUri,
      code_verifier: payload.codeVerifier,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await fetchImpl(`${apiBaseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: basicAuth,
      },
      body: body.toString(),
      cache: 'no-store',
    });

    const responseBody = await parseJsonSafe(response);
    if (!response.ok) {
      if (isRedirectUriMismatchError(responseBody) && index < redirectUriCandidates.length - 1) {
        continue;
      }

      const message =
        (typeof responseBody?.error_description === 'string' && responseBody.error_description) ||
        (typeof responseBody?.error === 'string' && responseBody.error) ||
        'TCM token exchange failed';

      throw new TcmOAuthServerError(message, response.status || 502, {
        code: typeof responseBody?.error === 'string' ? responseBody.error : undefined,
        traceId,
        details: responseBody,
      });
    }

    const tokenSet = toTokenSet(responseBody || {});
    return {
      tokenSet,
      redirectUri,
      traceId,
    };
  }

  throw new TcmOAuthServerError('TCM token exchange failed', 502, { traceId });
}

export async function fetchTcmUserInfo(
  accessToken: string,
  options: TcmOAuthServerOptions & { traceId?: string },
): Promise<TcmOAuthUserInfo> {
  const apiBaseUrl = getRequiredString(options.apiBaseUrl, 'apiBaseUrl').replace(/\/$/, '');
  const fetchImpl = getFetchImpl(options);
  const traceId = options.traceId ?? createTraceId();

  const response = await fetchImpl(`${apiBaseUrl}/oauth/userinfo`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: 'no-store',
  });

  const responseBody = await parseJsonSafe(response);
  if (!response.ok) {
    const message =
      (typeof responseBody?.error_description === 'string' && responseBody.error_description) ||
      (typeof responseBody?.error === 'string' && responseBody.error) ||
      'Failed to fetch TCM userinfo';

    throw new TcmOAuthServerError(message, response.status || 502, {
      code: typeof responseBody?.error === 'string' ? responseBody.error : undefined,
      traceId,
      details: responseBody,
    });
  }

  return (responseBody || {}) as TcmOAuthUserInfo;
}

export async function exchangeTcmPopupCode(
  payload: TcmAuthCodePayload,
  options: ExchangeTcmPopupCodeOptions,
): Promise<TcmOAuthExchangeResult> {
  if (options.expectedProvider && payload.provider !== options.expectedProvider) {
    throw new TcmOAuthServerError(
      `Unsupported provider for this endpoint. Expected provider=${options.expectedProvider}.`,
      400,
      { code: 'config_error', traceId: options.traceId },
    );
  }

  const { tokenSet, redirectUri, traceId } = await exchangeTcmAuthorizationCode(payload, options);
  const userInfo = await fetchTcmUserInfo(tokenSet.accessToken, {
    ...options,
    traceId,
  });

  return {
    tokenSet,
    userInfo,
    provider: payload.provider,
    redirectUri,
    traceId,
  };
}

export function toSingleFlightKey(payload: Pick<TcmAuthCodePayload, 'code' | 'state' | 'redirectUri' | 'provider'>): string {
  return createHash('sha256')
    .update(`${String(payload.code || '')}|${String(payload.state || '')}|${String(payload.redirectUri || '')}|${String(payload.provider || '')}`)
    .digest('hex');
}
