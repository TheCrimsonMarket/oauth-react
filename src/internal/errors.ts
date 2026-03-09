import type { TcmOAuthError, TcmOAuthErrorCode, TcmProvider } from '../types';

export function createError(
  code: TcmOAuthErrorCode,
  message: string,
  provider?: TcmProvider,
  cause?: unknown,
): TcmOAuthError {
  return { code, message, provider, cause };
}

export function normalizeProviderError(error: string, errorDescription?: string): TcmOAuthError {
  if (error === 'invalid_request' && (errorDescription || '').toLowerCase().includes('pkce required')) {
    return createError('config_error', 'Client PKCE policy requires code_challenge_method=S256.');
  }

  return createError(
    'provider_error',
    errorDescription ? `${error}: ${errorDescription}` : error,
  );
}
