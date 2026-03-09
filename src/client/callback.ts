import { readRedirectTransaction, saveRedirectResult } from '../internal/redirect';
import type { PopupResult } from '../types';

type PopupCallbackWindow = Window & {
  __tcmOauthPopupPostedStates?: Record<string, true>;
  __tcmOauthPopupPostedFallback?: boolean;
};

export interface PostPopupCallbackResultOptions {
  search?: string;
  closeDelaysMs?: number[];
  closeWindow?: boolean;
}

function parseCallbackResult(search: string): {
  result: PopupResult;
  stateKey?: string;
} {
  const params = new URLSearchParams(search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');
  const errorDescription = params.get('error_description');

  if (code && state) {
    return {
      result: {
        type: 'tcm_oauth_result',
        ok: true,
        code,
        state,
        iss: params.get('iss') || undefined,
      },
      stateKey: state,
    };
  }

  return {
    result: {
      type: 'tcm_oauth_result',
      ok: false,
      error: error || 'invalid_callback',
      error_description: errorDescription || 'Authorization callback did not include a valid code/state.',
      state: state || undefined,
      iss: params.get('iss') || undefined,
    },
    stateKey: state || undefined,
  };
}

function postToOpenerOnce(payload: unknown, stateKey?: string): void {
  const callbackWindow = window as PopupCallbackWindow;
  if (stateKey) {
    const postedStates = callbackWindow.__tcmOauthPopupPostedStates || {};
    if (postedStates[stateKey]) return;
    postedStates[stateKey] = true;
    callbackWindow.__tcmOauthPopupPostedStates = postedStates;
  } else {
    if (callbackWindow.__tcmOauthPopupPostedFallback) return;
    callbackWindow.__tcmOauthPopupPostedFallback = true;
  }

  if (!callbackWindow.opener) return;

  callbackWindow.opener.postMessage(payload, callbackWindow.location.origin);
}

export function postPopupCallbackResult(options: PostPopupCallbackResultOptions = {}): void {
  const { result, stateKey } = parseCallbackResult(options.search ?? window.location.search);
  postToOpenerOnce(result, stateKey);

  if (options.closeWindow === false) return;
  const closeDelaysMs = options.closeDelaysMs || [100, 220, 350];
  closeDelaysMs.forEach((delay) => {
    window.setTimeout(() => window.close(), delay);
  });
}

export function handleOAuthCallback(options: PostPopupCallbackResultOptions = {}): void {
  const search = options.search ?? window.location.search;
  const { result, stateKey } = parseCallbackResult(search);
  if (window.opener) {
    postToOpenerOnce(result, stateKey);
    if (options.closeWindow !== false) {
      const closeDelaysMs = options.closeDelaysMs || [100, 220, 350];
      closeDelaysMs.forEach((delay) => {
        window.setTimeout(() => window.close(), delay);
      });
    }
    return;
  }

  saveRedirectResult(result);
  const txn = readRedirectTransaction();
  const returnTo = txn?.returnTo || '/';
  window.location.replace(returnTo);
}
