import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleOAuthCallback, postPopupCallbackResult } from '../src/client/callback';

interface MockWindow {
  location: { origin: string; search: string; replace: ReturnType<typeof vi.fn> };
  opener: { postMessage: ReturnType<typeof vi.fn> } | null;
  setTimeout: typeof setTimeout;
  close: ReturnType<typeof vi.fn>;
  sessionStorage: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
  };
}

function withMockWindow(mockWindow: MockWindow) {
  Object.defineProperty(globalThis, 'window', {
    value: mockWindow,
    configurable: true,
    writable: true,
  });
}

describe('postPopupCallbackResult', () => {
  const opener = { postMessage: vi.fn() };
  const close = vi.fn();
  const replace = vi.fn();
  const setTimeoutSpy = vi.fn((cb: () => void) => {
    cb();
    return 1 as unknown as ReturnType<typeof setTimeout>;
  });
  const sessionStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };

  beforeEach(() => {
    opener.postMessage.mockReset();
    close.mockReset();
    replace.mockReset();
    setTimeoutSpy.mockClear();
    sessionStorage.getItem.mockReset();
    sessionStorage.setItem.mockReset();
    sessionStorage.removeItem.mockReset();
    withMockWindow({
      location: { origin: 'http://localhost:3693', search: '', replace },
      opener,
      setTimeout: setTimeoutSpy as unknown as typeof setTimeout,
      close,
      sessionStorage,
    });
  });

  afterEach(() => {
    // Clean up one-shot flags between tests.
    delete (window as Window & { __tcmOauthPopupPostedStates?: Record<string, true> }).__tcmOauthPopupPostedStates;
    delete (window as Window & { __tcmOauthPopupPostedFallback?: boolean }).__tcmOauthPopupPostedFallback;
  });

  it('posts successful callback payload once per state', () => {
    postPopupCallbackResult({
      search: '?code=code-1&state=state-1',
      closeDelaysMs: [],
    });
    postPopupCallbackResult({
      search: '?code=code-2&state=state-1',
      closeDelaysMs: [],
    });

    expect(opener.postMessage).toHaveBeenCalledTimes(1);
    expect(opener.postMessage).toHaveBeenCalledWith(
      {
        type: 'tcm_oauth_result',
        ok: true,
        code: 'code-1',
        state: 'state-1',
        iss: undefined,
      },
      'http://localhost:3693',
    );
  });

  it('posts error callback when code/state are missing', () => {
    postPopupCallbackResult({
      search: '?error=access_denied&error_description=User%20cancelled',
      closeDelaysMs: [],
    });

    expect(opener.postMessage).toHaveBeenCalledTimes(1);
    expect(opener.postMessage).toHaveBeenCalledWith(
      {
        type: 'tcm_oauth_result',
        ok: false,
        error: 'access_denied',
        error_description: 'User cancelled',
        state: undefined,
        iss: undefined,
      },
      'http://localhost:3693',
    );
  });

  it('suppresses duplicate invalid callback postings without state', () => {
    postPopupCallbackResult({
      search: '?error=invalid_callback',
      closeDelaysMs: [],
    });
    postPopupCallbackResult({
      search: '?error=invalid_callback',
      closeDelaysMs: [],
    });

    expect(opener.postMessage).toHaveBeenCalledTimes(1);
  });

  it('schedules popup close attempts by default', () => {
    postPopupCallbackResult({
      search: '?code=code-1&state=state-1',
    });

    expect(setTimeoutSpy).toHaveBeenCalledTimes(3);
    expect(close).toHaveBeenCalledTimes(3);
  });

  it('stores redirect callback result and returns to the original route when no opener is present', () => {
    withMockWindow({
      location: { origin: 'http://localhost:3693', search: '', replace },
      opener: null,
      setTimeout: setTimeoutSpy as unknown as typeof setTimeout,
      close,
      sessionStorage,
    });
    sessionStorage.getItem.mockReturnValueOnce(
      JSON.stringify({
        returnTo: '/account',
      }),
    );

    handleOAuthCallback({
      search: '?code=code-1&state=state-1',
    });

    expect(sessionStorage.setItem).toHaveBeenCalledWith(
      'tcm_oauth_redirect_result_v1',
      JSON.stringify({
        type: 'tcm_oauth_result',
        ok: true,
        code: 'code-1',
        state: 'state-1',
        iss: undefined,
      }),
    );
    expect(replace).toHaveBeenCalledWith('/account');
    expect(opener.postMessage).not.toHaveBeenCalled();
  });
});
