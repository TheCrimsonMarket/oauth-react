import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  tryAcquireFlowStartSlot,
  focusActivePopup,
  setPreparingFlow,
  setFlowError,
  setFlowExchanging,
  activatePopupFlow,
  claimFlowTransaction,
  finishPopupFlow,
  subscribeFlowSnapshot,
  getFlowSnapshot,
  releaseFlowStartSlot,
  clearConsumedCallbackState,
  resetSharedFlowState,
  createPkcePair,
  createState,
  openPopup,
  clearTransaction,
  saveTransaction,
  consumeTransaction,
  buildAuthorizeUrl,
  resolveTcmOAuthProvider,
  resolveTcmOAuthScope,
} = vi.hoisted(() => ({
  tryAcquireFlowStartSlot: vi.fn(),
  focusActivePopup: vi.fn(),
  setPreparingFlow: vi.fn(),
  setFlowError: vi.fn(),
  setFlowExchanging: vi.fn(),
  activatePopupFlow: vi.fn(),
  claimFlowTransaction: vi.fn(),
  finishPopupFlow: vi.fn(),
  subscribeFlowSnapshot: vi.fn(() => () => {}),
  getFlowSnapshot: vi.fn(() => ({
    phase: 'idle',
    error: null,
    activeFlowId: null,
    activeProvider: null,
    ownerInstanceId: null,
    exchangeStarted: false,
    terminal: false,
    authenticating: false,
  })),
  releaseFlowStartSlot: vi.fn(),
  clearConsumedCallbackState: vi.fn(),
  resetSharedFlowState: vi.fn(),
  createPkcePair: vi.fn(),
  createState: vi.fn(),
  openPopup: vi.fn(),
  clearTransaction: vi.fn(),
  saveTransaction: vi.fn(),
  consumeTransaction: vi.fn(),
  buildAuthorizeUrl: vi.fn(),
  resolveTcmOAuthProvider: vi.fn(),
  resolveTcmOAuthScope: vi.fn(),
}));

vi.mock('../src/internal/flowCoordinator', () => ({
  tryAcquireFlowStartSlot,
  focusActivePopup,
  setPreparingFlow,
  setFlowError,
  setFlowExchanging,
  activatePopupFlow,
  claimFlowTransaction,
  finishPopupFlow,
  subscribeFlowSnapshot,
  getFlowSnapshot,
  releaseFlowStartSlot,
  clearConsumedCallbackState,
  resetSharedFlowState,
}));

vi.mock('../src/internal/pkce', () => ({
  createPkcePair,
  createState,
}));

vi.mock('../src/internal/popup', () => ({
  openPopup,
}));

vi.mock('../src/internal/transaction', () => ({
  clearTransaction,
  saveTransaction,
  consumeTransaction,
}));

vi.mock('../src/internal/url', () => ({
  buildAuthorizeUrl,
}));

vi.mock('../src/client/policy', () => ({
  resolveTcmOAuthProvider,
  resolveTcmOAuthScope,
}));

import { createTcmOAuthClient } from '../src/client/createTcmOAuthClient';

async function flushAsyncWork(iterations = 4) {
  for (let index = 0; index < iterations; index += 1) {
    await Promise.resolve();
  }
}

function setMockWindow() {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    writable: true,
    value: {
      crypto: { subtle: {} },
      sessionStorage: {
        setItem: vi.fn(),
        getItem: vi.fn(),
        removeItem: vi.fn(),
      },
      open: vi.fn(),
      location: {
        origin: 'http://localhost:3693',
      },
    },
  });
}

describe('createTcmOAuthClient', () => {
  beforeEach(() => {
    setMockWindow();
    tryAcquireFlowStartSlot.mockReset();
    focusActivePopup.mockReset();
    setPreparingFlow.mockReset();
    setFlowError.mockReset();
    setFlowExchanging.mockReset();
    activatePopupFlow.mockReset();
    claimFlowTransaction.mockReset();
    finishPopupFlow.mockReset();
    releaseFlowStartSlot.mockReset();
    clearConsumedCallbackState.mockReset();
    resetSharedFlowState.mockReset();
    createPkcePair.mockReset();
    createState.mockReset();
    openPopup.mockReset();
    clearTransaction.mockReset();
    saveTransaction.mockReset();
    consumeTransaction.mockReset();
    buildAuthorizeUrl.mockReset();
    resolveTcmOAuthProvider.mockReset();
    resolveTcmOAuthScope.mockReset();
    resolveTcmOAuthProvider.mockResolvedValue('google');
    resolveTcmOAuthScope.mockResolvedValue('profile');
  });

  it('focuses existing popup and returns the in-flight promise when a second start is attempted', async () => {
    tryAcquireFlowStartSlot
      .mockReturnValueOnce({
        acquired: true,
        focusedExistingPopup: false,
      })
      .mockReturnValueOnce({
        acquired: false,
        focusedExistingPopup: false,
      });
    createPkcePair.mockResolvedValue({
      codeVerifier: 'verifier-1',
      codeChallenge: 'challenge-1',
    });
    createState.mockReturnValue('state-1');
    buildAuthorizeUrl.mockReturnValue('https://www.thecrimsonmarket.com/oauth/authorize?x=1');
    openPopup.mockReturnValue({
      closed: false,
      focus: vi.fn(),
      location: { href: '' },
    });
    claimFlowTransaction.mockReturnValue(true);
    consumeTransaction.mockReturnValue({
      state: 'state-1',
      codeVerifier: 'verifier-1',
      redirectUri: 'http://localhost:3693/auth/tcm/popup-callback',
      provider: 'google',
      expiresAt: Date.now() + 60_000,
    });

    let onPopupResult: ((result: unknown) => Promise<void>) | null = null;
    activatePopupFlow.mockImplementation((options: { onPopupResult: (result: unknown) => Promise<void> }) => {
      onPopupResult = options.onPopupResult;
      return 'flow-1';
    });

    const firstClient = createTcmOAuthClient({
      clientId: 'client-1',
      tcmWebUrl: 'https://www.thecrimsonmarket.com',
    });
    const secondClient = createTcmOAuthClient({
      clientId: 'client-1',
      tcmWebUrl: 'https://www.thecrimsonmarket.com',
    });

    const firstLogin = firstClient.loginWithPopup({ provider: 'google' });
    const secondLogin = secondClient.loginWithPopup({ provider: 'google' });

    await flushAsyncWork();

    expect(focusActivePopup).toHaveBeenCalledTimes(1);
    expect(openPopup).toHaveBeenCalledTimes(1);
    if (!onPopupResult) {
      throw new Error('Expected onPopupResult handler to be set');
    }
    const onPopupResultHandler = onPopupResult as (result: unknown) => Promise<void>;
    await onPopupResultHandler({
      type: 'tcm_oauth_result',
      ok: true,
      code: 'auth-code-1',
      state: 'state-1',
    });

    const [firstPayload, secondPayload] = await Promise.all([firstLogin, secondLogin]);
    expect(secondPayload).toEqual(firstPayload);
  });

  it('returns auth payload after valid callback result', async () => {
    tryAcquireFlowStartSlot.mockReturnValue({
      acquired: true,
      focusedExistingPopup: false,
    });
    createPkcePair.mockResolvedValue({
      codeVerifier: 'verifier-1',
      codeChallenge: 'challenge-1',
    });
    createState.mockReturnValue('state-1');
    buildAuthorizeUrl.mockReturnValue('https://www.thecrimsonmarket.com/oauth/authorize?x=1');
    openPopup.mockReturnValue({
      closed: false,
      focus: vi.fn(),
      location: { href: '' },
    });
    claimFlowTransaction.mockReturnValue(true);
    consumeTransaction.mockReturnValue({
      state: 'state-1',
      codeVerifier: 'verifier-1',
      redirectUri: 'http://localhost:3693/auth/tcm/popup-callback',
      provider: 'google',
      expiresAt: Date.now() + 60_000,
    });

    let onPopupResult: ((result: unknown) => Promise<void>) | null = null;
    activatePopupFlow.mockImplementation((options: { onPopupResult: (result: unknown) => Promise<void> }) => {
      onPopupResult = options.onPopupResult;
      return 'flow-1';
    });

    const client = createTcmOAuthClient({
      clientId: 'client-1',
      tcmWebUrl: 'https://www.thecrimsonmarket.com',
    });

    const login = client.loginWithPopup({ provider: 'google' });

    await flushAsyncWork();

    if (!onPopupResult) {
      throw new Error('Expected onPopupResult handler to be set');
    }
    const onPopupResultHandler = onPopupResult as (result: unknown) => Promise<void>;
    await onPopupResultHandler({
      type: 'tcm_oauth_result',
      ok: true,
      code: 'auth-code-1',
      state: 'state-1',
    });

    const payload = await login;

    expect(payload).toMatchObject({
      code: 'auth-code-1',
      state: 'state-1',
      codeVerifier: 'verifier-1',
      redirectUri: 'http://localhost:3693/auth/tcm/popup-callback',
      provider: 'google',
      _tcmFlowId: 'flow-1',
    });
    expect(setFlowExchanging).toHaveBeenCalledWith('flow-1');
    expect(finishPopupFlow).toHaveBeenCalledWith('flow-1');
  });

  it('supports chooser-mode login without pre-resolving a provider', async () => {
    tryAcquireFlowStartSlot.mockReturnValue({
      acquired: true,
      focusedExistingPopup: false,
    });
    createPkcePair.mockResolvedValue({
      codeVerifier: 'verifier-1',
      codeChallenge: 'challenge-1',
    });
    createState.mockReturnValue('state-1');
    buildAuthorizeUrl.mockReturnValue('https://www.thecrimsonmarket.com/oauth/authorize?x=1');
    openPopup.mockReturnValue({
      closed: false,
      focus: vi.fn(),
      location: { href: '' },
    });
    claimFlowTransaction.mockReturnValue(true);
    consumeTransaction.mockReturnValue({
      state: 'state-1',
      codeVerifier: 'verifier-1',
      redirectUri: 'http://localhost:3693/auth/tcm/popup-callback',
      expiresAt: Date.now() + 60_000,
    });

    let onPopupResult: ((result: unknown) => Promise<void>) | null = null;
    activatePopupFlow.mockImplementation((options: { onPopupResult: (result: unknown) => Promise<void> }) => {
      onPopupResult = options.onPopupResult;
      return 'flow-1';
    });

    const client = createTcmOAuthClient({
      clientId: 'client-1',
      tcmWebUrl: 'https://www.thecrimsonmarket.com',
      scope: 'profile email',
    });

    const login = client.loginWithPopup({});

    await flushAsyncWork();

    expect(resolveTcmOAuthProvider).not.toHaveBeenCalled();
    expect(setPreparingFlow).toHaveBeenCalledWith(expect.any(String), null);
    expect(buildAuthorizeUrl).toHaveBeenCalledWith(expect.objectContaining({
      provider: undefined,
      googleOnly: undefined,
    }));

    if (!onPopupResult) {
      throw new Error('Expected onPopupResult handler to be set');
    }
    const onPopupResultHandler = onPopupResult as (result: unknown) => Promise<void>;
    await onPopupResultHandler({
      type: 'tcm_oauth_result',
      ok: true,
      code: 'auth-code-1',
      state: 'state-1',
    });

    const payload = await login;
    expect(payload.provider).toBeUndefined();
  });

  it('returns the same snapshot reference when flow state has not changed', () => {
    const stableSnapshot = {
      phase: 'idle',
      error: null,
      activeFlowId: null,
      activeProvider: null,
      ownerInstanceId: null,
      exchangeStarted: false,
      terminal: false,
      authenticating: false,
    };
    getFlowSnapshot.mockReturnValue(stableSnapshot);

    const client = createTcmOAuthClient({
      clientId: 'client-1',
      tcmWebUrl: 'https://www.thecrimsonmarket.com',
    });

    const firstSnapshot = client.getSnapshot();
    const secondSnapshot = client.getSnapshot();

    expect(secondSnapshot).toBe(firstSnapshot);
  });
});
