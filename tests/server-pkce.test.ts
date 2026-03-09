import { describe, expect, it } from 'vitest';
import { toPkceS256Challenge } from '../src/server/pkce';

describe('toPkceS256Challenge', () => {
  it('matches known RFC7636 example output', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = toPkceS256Challenge(verifier);
    expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('throws for empty verifier', () => {
    expect(() => toPkceS256Challenge('')).toThrow('codeVerifier must be a non-empty string');
  });
});
