import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  loginWithPopup,
  clearError,
  subscribe,
  getSnapshot,
  focusActivePopup,
} = vi.hoisted(() => ({
  loginWithPopup: vi.fn(),
  clearError: vi.fn(),
  subscribe: vi.fn(() => () => {}),
  getSnapshot: vi.fn(() => ({
    phase: 'idle',
    error: null,
    activeProvider: null,
    flowId: null,
    authenticating: false,
  })),
  focusActivePopup: vi.fn(() => true),
}));

vi.mock('../src/client/createTcmOAuthClient', () => ({
  createTcmOAuthClient: vi.fn(() => ({
    loginWithPopup,
    clearError,
    subscribe,
    getSnapshot,
    focusActivePopup,
  })),
}));

import { createTcmOAuthPopupRouteClient } from '../src/client/createTcmOAuthPopupRouteClient';

describe('createTcmOAuthPopupRouteClient', () => {
  beforeEach(() => {
    loginWithPopup.mockReset();
    clearError.mockReset();
    subscribe.mockClear();
    getSnapshot.mockClear();
    focusActivePopup.mockClear();
  });

  it('exchanges a popup payload against the configured route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'ok', userId: 'user-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    loginWithPopup.mockResolvedValue({
      code: 'code-1',
      state: 'state-1',
      codeVerifier: 'verifier-1',
      redirectUri: 'http://localhost:3693/auth/tcm/popup-callback',
      provider: 'google',
      _tcmFlowId: 'flow-1',
      _tcmMessageId: 'msg-1',
    });

    const client = createTcmOAuthPopupRouteClient<{ message: string; userId: string }>({
      clientId: 'client-1',
      tcmWebUrl: 'https://www.thecrimsonmarket.com',
      exchangeEndpoint: '/api/custom-exchange',
      diagnostics: 'always',
      fetch: fetchMock,
    });

    const result = await client.loginWithPopupRoute({ provider: 'google' });

    expect(result).toEqual({ message: 'ok', userId: 'user-1' });
    expect(fetchMock).toHaveBeenCalledWith('/api/custom-exchange', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tcm-flow-id': 'flow-1',
        'x-tcm-message-id': 'msg-1',
      },
      body: JSON.stringify({
        code: 'code-1',
        state: 'state-1',
        codeVerifier: 'verifier-1',
        redirectUri: 'http://localhost:3693/auth/tcm/popup-callback',
        provider: 'google',
        _tcmFlowId: 'flow-1',
        _tcmMessageId: 'msg-1',
      }),
    });
  });

  it('normalizes non-2xx exchange failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: 'bad exchange' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    loginWithPopup.mockResolvedValue({
      code: 'code-1',
      state: 'state-1',
      codeVerifier: 'verifier-1',
      redirectUri: 'http://localhost:3693/auth/tcm/popup-callback',
      provider: 'google',
    });

    const client = createTcmOAuthPopupRouteClient({
      clientId: 'client-1',
      tcmWebUrl: 'https://www.thecrimsonmarket.com',
      fetch: fetchMock,
    });

    await expect(client.loginWithPopupRoute({ provider: 'google' })).rejects.toMatchObject({
      code: 'exchange_failed',
      message: 'bad exchange',
      provider: 'google',
    });
  });
});
