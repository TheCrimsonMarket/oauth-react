import { createError } from '../internal/errors';
import type { TcmOAuthClientPolicy, TcmProvider } from '../types';

const policyRequestCache = new Map<string, Promise<TcmOAuthClientPolicy>>();

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function buildPolicyCacheKey(tcmWebUrl: string, clientId: string): string {
  return `${tcmWebUrl.replace(/\/+$/, '')}::${clientId}`;
}

function resolvePolicyUrl(tcmWebUrl: string, clientId: string): string {
  return new URL(`/api/oauth/clients/${encodeURIComponent(clientId)}`, tcmWebUrl).toString();
}

export async function fetchTcmOAuthClientPolicy(options: {
  clientId: string;
  tcmWebUrl: string;
  fetchImpl?: typeof fetch;
}): Promise<TcmOAuthClientPolicy> {
  const cacheKey = buildPolicyCacheKey(options.tcmWebUrl, options.clientId);
  const cached = policyRequestCache.get(cacheKey);
  if (cached) return cached;

  const request = (async () => {
    const fetchImpl = options.fetchImpl ?? fetch;
    if (typeof fetchImpl !== 'function') {
      throw createError('config_error', 'Browser fetch is required for OAuth client policy discovery.');
    }

    const response = await fetchImpl(resolvePolicyUrl(options.tcmWebUrl, options.clientId), {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        (payload && typeof payload === 'object' && 'error_description' in payload && String(payload.error_description)) ||
        (payload && typeof payload === 'object' && 'message' in payload && String(payload.message)) ||
        'Failed to load OAuth client policy.';
      throw createError('config_error', message);
    }

    return {
      ...(payload as Record<string, unknown>),
      allowedScopes: normalizeStringArray((payload as Record<string, unknown>).allowedScopes),
      allowedProviders: normalizeStringArray((payload as Record<string, unknown>).allowedProviders) as TcmProvider[],
      pkcePolicy: typeof (payload as Record<string, unknown>).pkcePolicy === 'string'
        ? String((payload as Record<string, unknown>).pkcePolicy)
        : undefined,
    };
  })();

  policyRequestCache.set(cacheKey, request);

  try {
    return await request;
  } catch (error) {
    policyRequestCache.delete(cacheKey);
    throw error;
  }
}

export async function resolveTcmOAuthScope(options: {
  clientId: string;
  tcmWebUrl: string;
  requestedScope?: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const requestedScope = String(options.requestedScope || '').trim();
  if (requestedScope) {
    return requestedScope;
  }

  const policy = await fetchTcmOAuthClientPolicy(options);
  if (policy.allowedScopes.length === 1) {
    return policy.allowedScopes[0];
  }

  throw createError(
    'config_error',
    'OAuth scope must be provided when this client is allowed to request multiple scopes.',
  );
}

export async function resolveTcmOAuthProvider(options: {
  clientId: string;
  tcmWebUrl: string;
  requestedProvider?: TcmProvider;
  fetchImpl?: typeof fetch;
}): Promise<TcmProvider> {
  const policy = await fetchTcmOAuthClientPolicy(options);
  const requestedProvider = options.requestedProvider;

  if (requestedProvider) {
    if (!policy.allowedProviders.includes(requestedProvider)) {
      throw createError(
        'config_error',
        `OAuth provider ${requestedProvider} is not allowed for this client.`,
        requestedProvider,
      );
    }
    return requestedProvider;
  }

  if (policy.allowedProviders.length === 1) {
    return policy.allowedProviders[0];
  }

  throw createError(
    'config_error',
    'OAuth provider must be specified when this client is allowed to use multiple providers.',
  );
}
