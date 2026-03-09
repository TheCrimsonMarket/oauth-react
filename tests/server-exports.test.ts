import { describe, expect, it } from 'vitest';
import { resolvePopupRedirectUri, toPkceS256Challenge } from '../src/server';

describe('server exports', () => {
  it('exposes server helpers from the server barrel', () => {
    expect(typeof toPkceS256Challenge).toBe('function');
    expect(typeof resolvePopupRedirectUri).toBe('function');
  });
});
