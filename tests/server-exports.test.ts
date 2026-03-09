import { describe, expect, it } from 'vitest';
import {
  exchangeTcmAuthorizationCode,
  exchangeTcmPopupCode,
  fetchTcmUserInfo,
  resolvePopupRedirectUri,
  toPkceS256Challenge,
} from '../src/server';
import { createTcmOAuthExchangeRoute } from '../src/nextjs';

describe('server exports', () => {
  it('exposes server helpers from the server barrel', () => {
    expect(typeof toPkceS256Challenge).toBe('function');
    expect(typeof resolvePopupRedirectUri).toBe('function');
    expect(typeof exchangeTcmAuthorizationCode).toBe('function');
    expect(typeof exchangeTcmPopupCode).toBe('function');
    expect(typeof fetchTcmUserInfo).toBe('function');
    expect(typeof createTcmOAuthExchangeRoute).toBe('function');
  });
});
