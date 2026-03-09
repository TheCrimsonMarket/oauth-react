type PopupCallbackWindow = Window & {
  __tcmOauthPopupPostedStates?: Record<string, true>;
  __tcmOauthPopupPostedFallback?: boolean;
};

export interface PostPopupCallbackResultOptions {
  search?: string;
  closeDelaysMs?: number[];
  closeWindow?: boolean;
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
  const params = new URLSearchParams(options.search ?? window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  const error = params.get('error');
  const errorDescription = params.get('error_description');

  if (code && state) {
    postToOpenerOnce(
      {
        type: 'tcm_oauth_result',
        ok: true,
        code,
        state,
        iss: params.get('iss') || undefined,
      },
      state,
    );
  } else {
    postToOpenerOnce(
      {
        type: 'tcm_oauth_result',
        ok: false,
        error: error || 'invalid_callback',
        error_description: errorDescription || 'Authorization callback did not include a valid code/state.',
        state: state || undefined,
        iss: params.get('iss') || undefined,
      },
      state || undefined,
    );
  }

  if (options.closeWindow === false) return;
  const closeDelaysMs = options.closeDelaysMs || [100, 220, 350];
  closeDelaysMs.forEach((delay) => {
    window.setTimeout(() => window.close(), delay);
  });
}
