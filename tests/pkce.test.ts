import { describe, expect, it } from 'vitest';
import { createPkcePair } from '../src/internal/pkce';

describe('createPkcePair', () => {
  it('returns verifier and challenge strings', async () => {
    const pair = await createPkcePair();
    expect(pair.codeVerifier.length).toBeGreaterThan(42);
    expect(pair.codeChallenge.length).toBeGreaterThan(20);
  });
});
