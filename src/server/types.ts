import type { TcmAuthCodePayload, TcmProvider } from '../types';
import type {
  CreateTcmCookieSessionAdapterOptions,
  ResolveTcmAuthSessionOptions,
  TcmAuthSessionSource,
  TcmCookieSessionAdapter,
} from './session';

export interface TcmOAuthTokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
  raw: Record<string, unknown>;
}

export interface TcmOAuthUserInfo extends Record<string, unknown> {
  sub?: string;
  tcmid?: string;
  userName?: string | null;
  displayName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  googleId?: string | null;
}

export interface TcmOAuthCorrelationContext {
  enabled: boolean;
  flowId: string | null;
  messageId: string | null;
}

export interface TcmOAuthServerOptions {
  apiBaseUrl: string;
  clientId: string;
  clientSecret: string;
  callbackPath?: string;
  redirectUri?: string;
  fetch?: typeof fetch;
}

export interface ExchangeTcmAuthorizationCodeOptions extends TcmOAuthServerOptions {
  requestUrl?: string;
  traceId?: string;
}

export interface ExchangeTcmAuthorizationCodeResult {
  tokenSet: TcmOAuthTokenSet;
  redirectUri: string;
  traceId: string;
}

export interface ExchangeTcmPopupCodeOptions extends ExchangeTcmAuthorizationCodeOptions {
  expectedProvider?: TcmProvider;
}

export interface TcmOAuthExchangeResult {
  tokenSet: TcmOAuthTokenSet;
  userInfo: TcmOAuthUserInfo;
  provider: TcmProvider;
  redirectUri: string;
  traceId: string;
}

export class TcmOAuthServerError extends Error {
  status: number;
  code?: string;
  traceId?: string;
  details?: unknown;

  constructor(message: string, status: number, options?: { code?: string; traceId?: string; details?: unknown }) {
    super(message);
    this.name = 'TcmOAuthServerError';
    this.status = status;
    this.code = options?.code;
    this.traceId = options?.traceId;
    this.details = options?.details;
  }
}

export function isTcmOAuthServerError(error: unknown): error is TcmOAuthServerError {
  return error instanceof TcmOAuthServerError;
}

export interface CreateTcmOAuthExchangeRouteOptions<TSession = unknown, TBody = unknown> {
  oauth: TcmOAuthServerOptions & {
    expectedProvider?: TcmProvider;
  };
  diagnostics?: 'auto' | 'always' | 'never';
  onResolvedUser: (context: {
    userInfo: TcmOAuthUserInfo;
    tokenSet: TcmOAuthTokenSet;
    request: Request;
    traceId: string;
    correlation: TcmOAuthCorrelationContext;
    redirectUri: string;
    provider: TcmProvider;
    payload: TcmAuthCodePayload;
  }) => Promise<{
    body: TBody;
    session?: TSession;
    status?: number;
    headers?: HeadersInit;
  }>;
  applySession?: (
    response: Response,
    session: TSession,
    context: { request: Request; traceId: string; correlation: TcmOAuthCorrelationContext },
  ) => Promise<void> | void;
}

export type {
  CreateTcmCookieSessionAdapterOptions,
  ResolveTcmAuthSessionOptions,
  TcmAuthSessionSource,
  TcmCookieSessionAdapter,
};

export interface CreateTcmLogoutRouteOptions<TSession extends Record<string, unknown>> {
  resolveSession: (
    request: Request,
  ) => Promise<(TSession & { authSource: string }) | null> | (TSession & { authSource: string }) | null;
  standaloneSessionAdapter: TcmCookieSessionAdapter;
  standaloneAuthSources?: string[];
  onSharedCookieLogout?: (context: {
    request: Request;
    session: TSession & { authSource: string };
  }) => Promise<Response | null | void> | Response | null | void;
}
