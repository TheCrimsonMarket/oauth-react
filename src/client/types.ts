import type { TcmAuthCodePayload, TcmOAuthError, TcmProvider } from '../types';

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
  popup?: {
    width?: number;
    height?: number;
  };
}

export interface TcmOAuthPopupLoginParams {
  provider: TcmProvider;
}

export interface TcmOAuthClient {
  loginWithPopup: (params: TcmOAuthPopupLoginParams) => Promise<TcmAuthCodePayload>;
  clearError: () => void;
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => TcmOAuthClientSnapshot;
  focusActivePopup: () => boolean;
}
