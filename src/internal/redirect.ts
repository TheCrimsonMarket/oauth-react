import { createError, normalizeProviderError } from './errors';
import { createPkcePair, createState } from './pkce';
import { buildAuthorizeUrl } from './url';
import type { TcmAuthCodePayload, PopupResult, TcmOAuthError, TcmProvider } from '../types';

const REDIRECT_TXN_STORAGE_KEY = 'tcm_oauth_redirect_txn_v1';
const REDIRECT_RESULT_STORAGE_KEY = 'tcm_oauth_redirect_result_v1';
const TXN_TTL_MS = 10 * 60 * 1000;

interface RedirectTransaction {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  provider?: TcmProvider;
  createdAt: number;
  expiresAt: number;
  tcmWebUrl: string;
  returnTo: string;
}

function readJson<T>(storageKey: string): T | null {
  const raw = window.sessionStorage.getItem(storageKey);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function saveJson(storageKey: string, value: unknown): void {
  window.sessionStorage.setItem(storageKey, JSON.stringify(value));
}

export function clearRedirectTransaction(): void {
  window.sessionStorage.removeItem(REDIRECT_TXN_STORAGE_KEY);
}

export function saveRedirectTransaction(txn: RedirectTransaction): void {
  saveJson(REDIRECT_TXN_STORAGE_KEY, txn);
}

export function readRedirectTransaction(): RedirectTransaction | null {
  return readJson<RedirectTransaction>(REDIRECT_TXN_STORAGE_KEY);
}

export function consumeRedirectTransaction(): RedirectTransaction | null {
  const txn = readRedirectTransaction();
  clearRedirectTransaction();
  return txn;
}

export function saveRedirectResult(result: PopupResult): void {
  saveJson(REDIRECT_RESULT_STORAGE_KEY, result);
}

export function hasPendingRedirectResult(): boolean {
  return window.sessionStorage.getItem(REDIRECT_RESULT_STORAGE_KEY) !== null;
}

export function clearRedirectResult(): void {
  window.sessionStorage.removeItem(REDIRECT_RESULT_STORAGE_KEY);
}

export function consumeRedirectResult(): PopupResult | null {
  const result = readJson<PopupResult>(REDIRECT_RESULT_STORAGE_KEY);
  clearRedirectResult();
  return result;
}

function toReturnToPath(rawReturnTo: string | undefined): string {
  if (rawReturnTo && rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//')) {
    return rawReturnTo;
  }

  const currentPath =
    `${window.location.pathname || '/'}${window.location.search || ''}${window.location.hash || ''}` || '/';

  if (currentPath.startsWith('/auth/')) {
    return '/';
  }

  return currentPath;
}

export async function startRedirectLogin(options: {
  clientId: string;
  tcmWebUrl: string;
  callbackPath: string;
  scope: string;
  provider?: TcmProvider;
  googleOnly?: boolean;
  returnTo?: string;
}): Promise<never> {
  if (!window.crypto?.subtle || !window.sessionStorage || typeof window.location?.assign !== 'function') {
    throw createError('unsupported_browser', 'Browser does not support required OAuth redirect APIs.', options.provider);
  }

  if (!options.clientId || !options.tcmWebUrl) {
    throw createError('config_error', 'Missing required SDK config: clientId or tcmWebUrl.', options.provider);
  }

  const redirectUri = new URL(options.callbackPath, window.location.origin).toString();
  const { codeVerifier, codeChallenge } = await createPkcePair();
  const state = createState();
  const now = Date.now();

  saveRedirectTransaction({
    state,
    codeVerifier,
    redirectUri,
    provider: options.provider,
    createdAt: now,
    expiresAt: now + TXN_TTL_MS,
    tcmWebUrl: options.tcmWebUrl,
    returnTo: toReturnToPath(options.returnTo),
  });

  const authUrl = buildAuthorizeUrl({
    tcmWebUrl: options.tcmWebUrl,
    clientId: options.clientId,
    redirectUri,
    scope: options.scope,
    state,
    codeChallenge,
    provider: options.provider,
    googleOnly: options.googleOnly,
    interactionMode: 'redirect',
  });

  window.location.assign(authUrl);
  return new Promise<never>(() => undefined);
}

export function resumeRedirectPayloadIfPresent(): TcmAuthCodePayload | null {
  const result = consumeRedirectResult();
  if (!result) return null;

  const txn = consumeRedirectTransaction();
  if (!txn) {
    throw createError('txn_missing', 'OAuth transaction not found.');
  }

  if (Date.now() > txn.expiresAt) {
    throw createError('txn_expired', 'OAuth transaction expired.', txn.provider);
  }

  if ((result.state || '') !== txn.state) {
    throw createError('state_mismatch', 'OAuth state mismatch detected.', txn.provider);
  }

  if (!result.ok) {
    throw normalizeProviderError(result.error, result.error_description);
  }

  return {
    code: result.code,
    state: txn.state,
    codeVerifier: txn.codeVerifier,
    redirectUri: txn.redirectUri,
    provider: txn.provider,
  };
}
