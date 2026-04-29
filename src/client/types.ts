import type {
  TcmAuthCodePayload,
  TcmOAuthError,
  TcmOAuthInteractionMode,
  TcmProvider,
  TcmResolvedOAuthInteractionMode,
} from '../types';

export type TcmOAuthClientPhase =
  | 'idle'
  | 'preparing'
  | 'interactive_provider'
  | 'awaiting_code_exchange'
  | 'done'
  | 'error';

export interface TcmOAuthClientSnapshot {
  phase: TcmOAuthClientPhase;
  error: TcmOAuthError | null;
  activeProvider: TcmProvider | null;
  flowId: string | null;
  authenticating: boolean;
}

export interface CreateTcmOAuthClientOptions {
  clientId: string;
  tcmWebUrl: string;
  callbackPath?: string;
  scope?: string;
  googleOnly?: boolean;
  fetch?: typeof fetch;
  popup?: {
    width?: number;
    height?: number;
  };
}

export interface TcmOAuthPopupLoginParams {
  provider?: TcmProvider;
}

export interface TcmOAuthClient {
  loginWithPopup: (params: TcmOAuthPopupLoginParams) => Promise<TcmAuthCodePayload>;
  clearError: () => void;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => TcmOAuthClientSnapshot;
  focusActivePopup: () => boolean;
}

export type TcmOAuthDiagnosticsMode = 'auto' | 'always' | 'never';

export interface CreateTcmOAuthPopupRouteClientOptions<TExchangeResult = unknown> extends CreateTcmOAuthClientOptions {
  exchangeEndpoint?: string;
  diagnostics?: TcmOAuthDiagnosticsMode;
  fetch?: typeof fetch;
}

export interface TcmOAuthPopupRouteClient<TExchangeResult = unknown> extends TcmOAuthClient {
  exchangeCodeViaRoute: (payload: TcmAuthCodePayload) => Promise<TExchangeResult>;
  loginWithPopupRoute: (params: TcmOAuthPopupLoginParams) => Promise<TExchangeResult>;
}

export interface CreateTcmOAuthRouteClientOptions<TExchangeResult = unknown>
  extends CreateTcmOAuthPopupRouteClientOptions<TExchangeResult> {
  interactionMode?: TcmOAuthInteractionMode;
  fallbackToRedirect?: boolean;
  returnTo?: string;
}

export interface TcmOAuthRouteClient<TExchangeResult = unknown> extends TcmOAuthPopupRouteClient<TExchangeResult> {
  hasPendingRedirectResult: () => boolean;
  loginWithRoute: (params: TcmOAuthPopupLoginParams) => Promise<TExchangeResult>;
  resumeRedirectRouteIfPresent: () => Promise<TExchangeResult | null>;
  resolveInteractionMode: () => TcmResolvedOAuthInteractionMode;
}
