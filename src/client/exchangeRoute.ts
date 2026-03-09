import { createError } from '../internal/errors';
import type { TcmAuthCodePayload, TcmOAuthError } from '../types';
import type { TcmOAuthDiagnosticsMode } from './types';

const CORRELATION_HEADER_MAX_LENGTH = 128;

function shouldSendDiagnostics(mode: TcmOAuthDiagnosticsMode): boolean {
  if (mode === 'always') return true;
  if (mode === 'never') return false;

  const appEnv = (
    process.env.NEXT_PUBLIC_APP_ENV ||
    process.env.APP_ENV ||
    process.env.NEXT_PUBLIC_ENV ||
    ''
  ).toLowerCase();

  return process.env.NODE_ENV !== 'production' || appEnv === 'staging';
}

function toSafeCorrelationHeaderValue(value: string | undefined): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > CORRELATION_HEADER_MAX_LENGTH) return null;
  if (!/^[a-zA-Z0-9._:-]+$/.test(trimmed)) return null;
  return trimmed;
}

async function parseJsonSafe(response: Response): Promise<Record<string, unknown> | null> {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return null;
  }

  const parsed = await response.json().catch(() => null);
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  return parsed as Record<string, unknown>;
}

export async function exchangeCodeViaRoute<TExchangeResult>(
  payload: TcmAuthCodePayload,
  options: {
    exchangeEndpoint: string;
    diagnostics: TcmOAuthDiagnosticsMode;
    fetchImpl?: typeof fetch;
  },
): Promise<TExchangeResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  if (typeof fetchImpl !== 'function') {
    throw createError('config_error', 'Browser fetch is required for route-backed OAuth exchange.', payload.provider);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (shouldSendDiagnostics(options.diagnostics)) {
    const flowId = toSafeCorrelationHeaderValue(payload._tcmFlowId);
    const messageId = toSafeCorrelationHeaderValue(payload._tcmMessageId);
    if (flowId) headers['x-tcm-flow-id'] = flowId;
    if (messageId) headers['x-tcm-message-id'] = messageId;
  }

  let response: Response;
  try {
    response = await fetchImpl(options.exchangeEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  } catch (cause) {
    throw createError('exchange_failed', 'Partner code exchange failed.', payload.provider, cause);
  }

  const responseBody = await parseJsonSafe(response);
  if (!response.ok) {
    const message =
      (typeof responseBody?.message === 'string' && responseBody.message) ||
      (typeof responseBody?.error === 'string' && responseBody.error) ||
      'Partner code exchange failed.';

    const error: TcmOAuthError = createError('exchange_failed', message, payload.provider, responseBody || response.status);
    throw error;
  }

  return (responseBody as TExchangeResult | null) ?? (undefined as TExchangeResult);
}
