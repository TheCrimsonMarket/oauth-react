import { describe, expect, it } from 'vitest';
import { SUPPORTED_PROVIDERS, isSupportedProvider } from '../src/internal/providers';

describe('provider support guards', () => {
  it('contains all plan-supported providers', () => {
    expect(SUPPORTED_PROVIDERS).toEqual([
      'google',
      'steam',
      'battlenet',
      'discord',
      'twitch',
      'credentials',
    ]);
  });

  it('accepts valid providers and rejects unknown values', () => {
    expect(isSupportedProvider('google')).toBe(true);
    expect(isSupportedProvider('steam')).toBe(true);
    expect(isSupportedProvider('unknown-provider')).toBe(false);
  });
});
