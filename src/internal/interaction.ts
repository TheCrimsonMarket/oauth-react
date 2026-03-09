import type { TcmOAuthInteractionMode, TcmResolvedOAuthInteractionMode } from '../types';

const MOBILE_UA_RE =
  /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|windows phone/i;
const IN_APP_BROWSER_RE =
  /fban|fbav|instagram|line|micromessenger|wv\)|webview|snapchat|tiktok/i;

function readUserAgent(): string {
  if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') {
    return '';
  }
  return navigator.userAgent;
}

function isLikelyMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;

  const coarsePointer =
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const narrowViewport = window.innerWidth > 0 && window.innerWidth <= 900;

  return coarsePointer && narrowViewport;
}

export function resolveInteractionMode(
  requestedMode: TcmOAuthInteractionMode | undefined,
): TcmResolvedOAuthInteractionMode {
  if (requestedMode === 'popup' || requestedMode === 'redirect') {
    return requestedMode;
  }

  const userAgent = readUserAgent();
  if (MOBILE_UA_RE.test(userAgent) || IN_APP_BROWSER_RE.test(userAgent) || isLikelyMobileViewport()) {
    return 'redirect';
  }

  return 'popup';
}
