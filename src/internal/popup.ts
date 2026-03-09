export interface PopupSize {
  width: number;
  height: number;
}

export function openPopup(url: string, size: PopupSize): Window | null {
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - size.width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - size.height) / 2));

  const features = [
    `popup=yes`,
    `width=${size.width}`,
    `height=${size.height}`,
    `left=${left}`,
    `top=${top}`,
    'resizable=yes',
    'scrollbars=yes',
  ].join(',');

  const popup = window.open(url, 'tcm_oauth_popup', features);

  if (popup && typeof popup.focus === 'function') {
    popup.focus();
  }

  return popup;
}

export function focusPopup(popup: Window | null): boolean {
  if (!popup || popup.closed) return false;
  if (typeof popup.focus === 'function') {
    popup.focus();
  }
  return true;
}

export function pollPopupClosed(
  popup: Window,
  onClosed: () => void,
): () => void {
  const timer = window.setInterval(() => {
    if (popup.closed) {
      window.clearInterval(timer);
      onClosed();
    }
  }, 300);

  return () => window.clearInterval(timer);
}
