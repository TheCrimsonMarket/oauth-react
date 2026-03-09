import { describe, expect, it } from 'vitest';
import { createTcmOAuthClient } from '../src/client';
import { postPopupCallbackResult } from '../src/client/callback';

describe('client exports', () => {
  it('exposes createTcmOAuthClient and callback helper', () => {
    expect(typeof createTcmOAuthClient).toBe('function');
    expect(typeof postPopupCallbackResult).toBe('function');
  });
});
