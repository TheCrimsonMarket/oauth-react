export type TcmProvider =
  | 'google'
  | 'steam'
  | 'battlenet'
  | 'discord'
  | 'twitch'
  | 'credentials';

export type TcmOAuthPhase =
  | 'idle'
  | 'preparing'
  | 'interactive_provider'
  | 'exchanging_partner'
  | 'done'
  | 'error';

export type TcmOAuthInteractionMode = 'auto' | 'popup' | 'redirect';
export type TcmResolvedOAuthInteractionMode = 'popup' | 'redirect';

export type TcmOAuthErrorCode =
  | 'popup_blocked'
  | 'popup_closed'
  | 'state_mismatch'
  | 'txn_missing'
  | 'txn_expired'
  | 'provider_error'
  | 'exchange_failed'
  | 'config_error'
  | 'unsupported_browser'
  | 'unknown_error';

export interface TcmOAuthError {
  code: TcmOAuthErrorCode;
  message: string;
  provider?: TcmProvider;
  cause?: unknown;
}

export interface TcmAuthCodePayload {
  code: string;
  state: string;
  codeVerifier: string;
  redirectUri: string;
  provider: TcmProvider;
  _tcmFlowId?: string;
  _tcmMessageId?: string;
}

export interface UseTcmOAuthPopupOptions<TExchangeResult = unknown> {
  clientId: string;
  tcmWebUrl: string;
  callbackPath?: string;
  scope?: string;
  fetch?: typeof fetch;
  exchangeCode: (payload: TcmAuthCodePayload) => Promise<TExchangeResult>;
  popup?: { width?: number; height?: number };
  onSuccess?: (result: TExchangeResult) => void | Promise<void>;
  onError?: (error: TcmOAuthError) => void;
}

export interface UseTcmOAuthPopupReturn<TExchangeResult = unknown> {
  authenticating: boolean;
  phase: TcmOAuthPhase;
  error: TcmOAuthError | null;
  startLogin: (provider?: TcmProvider) => Promise<void>;
  clearError: () => void;
}

export type TcmOAuthDiagnosticsMode = 'auto' | 'always' | 'never';

export interface UseTcmOAuthPopupRouteOptions<TExchangeResult = unknown> {
  clientId: string;
  tcmWebUrl: string;
  exchangeEndpoint?: string;
  callbackPath?: string;
  scope?: string;
  popup?: { width?: number; height?: number };
  diagnostics?: TcmOAuthDiagnosticsMode;
  fetch?: typeof fetch;
  onSuccess?: (result: TExchangeResult) => void | Promise<void>;
  onError?: (error: TcmOAuthError) => void;
}

export interface UseTcmOAuthPopupRouteReturn<TExchangeResult = unknown> {
  authenticating: boolean;
  phase: TcmOAuthPhase;
  error: TcmOAuthError | null;
  startLogin: (provider?: TcmProvider) => Promise<void>;
  clearError: () => void;
}

export interface UseTcmOAuthOptions<TExchangeResult = unknown> {
  clientId: string;
  tcmWebUrl: string;
  exchangeEndpoint?: string;
  callbackPath?: string;
  scope?: string;
  popup?: { width?: number; height?: number };
  diagnostics?: TcmOAuthDiagnosticsMode;
  fetch?: typeof fetch;
  interactionMode?: TcmOAuthInteractionMode;
  fallbackToRedirect?: boolean;
  returnTo?: string;
  onSuccess?: (result: TExchangeResult) => void | Promise<void>;
  onError?: (error: TcmOAuthError) => void;
}

export interface UseTcmOAuthReturn<TExchangeResult = unknown> {
  authenticating: boolean;
  phase: TcmOAuthPhase;
  error: TcmOAuthError | null;
  resolvedInteractionMode: TcmResolvedOAuthInteractionMode | null;
  startLogin: (provider?: TcmProvider) => Promise<void>;
  clearError: () => void;
}

export type PopupResult =
  | { type: 'tcm_oauth_result'; ok: true; code: string; state: string; iss?: string }
  | {
      type: 'tcm_oauth_result';
      ok: false;
      error: string;
      error_description?: string;
      state?: string;
      iss?: string;
    };
