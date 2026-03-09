export interface ResolvePopupRedirectUriInput {
  requestUrl: string;
  callbackPath?: string;
  explicitRedirectUri?: string;
}

const DEFAULT_CALLBACK_PATH = '/auth/tcm/popup-callback';

export function resolvePopupRedirectUri({
  requestUrl,
  callbackPath = DEFAULT_CALLBACK_PATH,
  explicitRedirectUri,
}: ResolvePopupRedirectUriInput): string {
  if (explicitRedirectUri) {
    return explicitRedirectUri;
  }

  if (!requestUrl || typeof requestUrl !== 'string') {
    throw new TypeError('requestUrl must be a non-empty string when explicitRedirectUri is not provided');
  }

  if (!callbackPath.startsWith('/')) {
    throw new TypeError('callbackPath must start with "/"');
  }

  const request = new URL(requestUrl);
  return `${request.origin}${callbackPath}`;
}
