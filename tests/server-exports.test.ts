import { describe, expect, it } from 'vitest';
import {
  createTcmCookieSessionAdapter,
  exchangeTcmAuthorizationCode,
  exchangeTcmPopupCode,
  fetchTcmUserInfo,
  refreshTcmAccessToken,
  revokeTcmToken,
  resolveTcmAuthSession,
  resolvePopupRedirectUri,
  toPkceS256Challenge,
} from '../src/server';
import {
  createTcmLogoutRoute,
  createTcmOAuthExchangeRoute,
  refreshTcmAccessToken as refreshTcmAccessTokenFromNextjs,
  revokeTcmToken as revokeTcmTokenFromNextjs,
} from '../src/nextjs';

describe('server exports', () => {
  it('exposes server helpers from the server barrel', () => {
    expect(typeof toPkceS256Challenge).toBe('function');
    expect(typeof resolvePopupRedirectUri).toBe('function');
    expect(typeof exchangeTcmAuthorizationCode).toBe('function');
    expect(typeof exchangeTcmPopupCode).toBe('function');
    expect(typeof fetchTcmUserInfo).toBe('function');
    expect(typeof refreshTcmAccessToken).toBe('function');
    expect(typeof revokeTcmToken).toBe('function');
    expect(typeof createTcmCookieSessionAdapter).toBe('function');
    expect(typeof resolveTcmAuthSession).toBe('function');
    expect(typeof createTcmOAuthExchangeRoute).toBe('function');
    expect(typeof createTcmLogoutRoute).toBe('function');
  });

  it('re-exposes refresh and revoke helpers from the nextjs barrel', () => {
    expect(typeof refreshTcmAccessTokenFromNextjs).toBe('function');
    expect(typeof revokeTcmTokenFromNextjs).toBe('function');
  });
});
