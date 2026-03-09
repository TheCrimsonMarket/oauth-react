import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { postPopupCallbackResult } from '../src/client/callback';

interface MockWindow {
  location: { origin: string; search: string };
  opener: { postMessage: ReturnType<typeof vi.fn> } | null;
  setTimeout: typeof setTimeout;
  close: ReturnType<typeof vi.fn>;
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
  const setTimeoutSpy = vi.fn((cb: () => void) => {
    cb();
    return 1 as unknown as ReturnType<typeof setTimeout>;
  });

  beforeEach(() => {
    opener.postMessage.mockReset();
    close.mockReset();
    setTimeoutSpy.mockClear();
    withMockWindow({
      location: { origin: 'http://localhost:3693', search: '' },
      opener,
      setTimeout: setTimeoutSpy as unknown as typeof setTimeout,
      close,
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
});
