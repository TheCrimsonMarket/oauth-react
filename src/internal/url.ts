import type { TcmProvider, TcmResolvedOAuthInteractionMode } from '../types';

interface BuildAuthorizeUrlOptions {
  tcmWebUrl: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  state: string;
  codeChallenge: string;
  provider: TcmProvider;
  interactionMode?: TcmResolvedOAuthInteractionMode;
}

export function buildAuthorizeUrl(options: BuildAuthorizeUrlOptions): string {
  const url = new URL('/oauth/authorize', options.tcmWebUrl);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', options.clientId);
  url.searchParams.set('redirect_uri', options.redirectUri);
  url.searchParams.set('scope', options.scope);
  url.searchParams.set('state', options.state);
  url.searchParams.set('code_challenge', options.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if ((options.interactionMode ?? 'popup') === 'popup') {
    url.searchParams.set('ui_mode', 'popup');
  }

  if (options.provider === 'google') {
    url.searchParams.set('required_provider', 'google');
  }

  return url.toString();
}
