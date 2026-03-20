import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  resetSharedFlowState,
  clearTransaction,
  clearRedirectTransaction,
  clearRedirectResult,
} = vi.hoisted(() => ({
  resetSharedFlowState: vi.fn(),
  clearTransaction: vi.fn(),
  clearRedirectTransaction: vi.fn(),
  clearRedirectResult: vi.fn(),
}));

vi.mock('../src/internal/flowCoordinator', () => ({
  resetSharedFlowState,
}));

vi.mock('../src/internal/transaction', () => ({
  clearTransaction,
}));

vi.mock('../src/internal/redirect', () => ({
  clearRedirectTransaction,
  clearRedirectResult,
}));

import { resetTcmOAuthBrowserState } from '../src/browser/reset';

describe('resetTcmOAuthBrowserState', () => {
  beforeEach(() => {
    resetSharedFlowState.mockReset();
    clearTransaction.mockReset();
    clearRedirectTransaction.mockReset();
    clearRedirectResult.mockReset();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: {
        __tcmOauthClientState: {
          inFlightLoginPromise: Promise.resolve(null),
        },
      },
    });
  });

  it('clears shared flow and browser-stored oauth state', () => {
    resetTcmOAuthBrowserState();

    expect(resetSharedFlowState).toHaveBeenCalledTimes(1);
    expect(clearTransaction).toHaveBeenCalledTimes(1);
    expect(clearRedirectTransaction).toHaveBeenCalledTimes(1);
    expect(clearRedirectResult).toHaveBeenCalledTimes(1);
    expect((window as typeof window & { __tcmOauthClientState?: { inFlightLoginPromise: Promise<null> | null } }).__tcmOauthClientState?.inFlightLoginPromise).toBeNull();
  });
});
