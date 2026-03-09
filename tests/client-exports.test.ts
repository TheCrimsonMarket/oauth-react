import { describe, expect, it } from 'vitest';
import { createTcmOAuthClient, createTcmOAuthPopupClient, createTcmOAuthPopupRouteClient, createTcmOAuthRouteClient } from '../src/client';
import { handleOAuthCallback, postPopupCallbackResult } from '../src/client/callback';

describe('client exports', () => {
  it('exposes createTcmOAuthClient and callback helper', () => {
    expect(typeof createTcmOAuthClient).toBe('function');
    expect(typeof createTcmOAuthPopupClient).toBe('function');
    expect(typeof createTcmOAuthPopupRouteClient).toBe('function');
    expect(typeof createTcmOAuthRouteClient).toBe('function');
    expect(typeof postPopupCallbackResult).toBe('function');
    expect(typeof handleOAuthCallback).toBe('function');
  });
});
