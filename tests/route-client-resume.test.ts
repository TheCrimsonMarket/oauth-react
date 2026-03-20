import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  exchangeCodeViaRoute,
  resolveInteractionMode,
  hasPendingRedirectResult,
  resumeRedirectPayloadIfPresent,
  startRedirectLogin,
  setFlowDone,
  setFlowError,
  popupRouteClient,
} = vi.hoisted(() => ({
  exchangeCodeViaRoute: vi.fn(),
  resolveInteractionMode: vi.fn(),
  hasPendingRedirectResult: vi.fn(),
  resumeRedirectPayloadIfPresent: vi.fn(),
  startRedirectLogin: vi.fn(),
  setFlowDone: vi.fn(),
  setFlowError: vi.fn(),
  popupRouteClient: {
    loginWithPopupRoute: vi.fn(),
    exchangeCodeViaRoute: vi.fn(),
    clearError: vi.fn(),
    subscribe: vi.fn(() => () => {}),
    getSnapshot: vi.fn(() => ({
      phase: 'idle',
      error: null,
      activeProvider: null,
      flowId: null,
      authenticating: false,
    })),
    focusActivePopup: vi.fn(() => false),
  },
}));

vi.mock('../src/client/createTcmOAuthPopupRouteClient', () => ({
  createTcmOAuthPopupRouteClient: vi.fn(() => popupRouteClient),
}));

vi.mock('../src/client/exchangeRoute', () => ({
  exchangeCodeViaRoute,
}));

vi.mock('../src/internal/interaction', () => ({
  resolveInteractionMode,
}));

vi.mock('../src/internal/redirect', () => ({
  hasPendingRedirectResult,
  resumeRedirectPayloadIfPresent,
  startRedirectLogin,
}));

vi.mock('../src/internal/flowCoordinator', () => ({
  setFlowDone,
  setFlowError,
}));

import { createTcmOAuthRouteClient } from '../src/client/createTcmOAuthRouteClient';

describe('createTcmOAuthRouteClient redirect resume', () => {
  beforeEach(() => {
    exchangeCodeViaRoute.mockReset();
    resolveInteractionMode.mockReset();
    hasPendingRedirectResult.mockReset();
    resumeRedirectPayloadIfPresent.mockReset();
    startRedirectLogin.mockReset();
    setFlowDone.mockReset();
    setFlowError.mockReset();
    popupRouteClient.loginWithPopupRoute.mockReset();
  });

  it('marks the shared flow done after a resumed redirect exchange succeeds', async () => {
    resumeRedirectPayloadIfPresent.mockReturnValue({
      code: 'code-1',
      state: 'state-1',
      codeVerifier: 'verifier-1',
      redirectUri: 'https://partner.example.com/auth/tcm/callback',
      provider: 'google',
      _tcmFlowId: 'flow-1',
    });
    exchangeCodeViaRoute.mockResolvedValue({ userId: 'user-1' });

    const client = createTcmOAuthRouteClient<{ userId: string }>({
      clientId: 'client-1',
      tcmWebUrl: 'https://www.thecrimsonmarket.com',
      fetch: vi.fn(),
    });

    const result = await client.resumeRedirectRouteIfPresent();

    expect(result).toEqual({ userId: 'user-1' });
    expect(setFlowDone).toHaveBeenCalledWith('flow-1');
  });

  it('marks the shared flow error after a resumed redirect exchange fails', async () => {
    resumeRedirectPayloadIfPresent.mockReturnValue({
      code: 'code-1',
      state: 'state-1',
      codeVerifier: 'verifier-1',
      redirectUri: 'https://partner.example.com/auth/tcm/callback',
      provider: 'google',
      _tcmFlowId: 'flow-1',
    });
    exchangeCodeViaRoute.mockRejectedValue({
      code: 'exchange_failed',
      message: 'bad exchange',
      provider: 'google',
    });

    const client = createTcmOAuthRouteClient({
      clientId: 'client-1',
      tcmWebUrl: 'https://www.thecrimsonmarket.com',
      fetch: vi.fn(),
    });

    await expect(client.resumeRedirectRouteIfPresent()).rejects.toMatchObject({
      code: 'exchange_failed',
      message: 'bad exchange',
      provider: 'google',
    });

    expect(setFlowError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'exchange_failed',
        message: 'bad exchange',
        provider: 'google',
      }),
      { flowId: 'flow-1' },
    );
  });
});
