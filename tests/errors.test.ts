import { describe, expect, it } from 'vitest';
import { normalizeProviderError } from '../src/internal/errors';

describe('normalizeProviderError', () => {
  it('maps PKCE enforcement error to config_error', () => {
    const error = normalizeProviderError('invalid_request', 'PKCE required: code_challenge and code_challenge_method=S256 are mandatory for this client');
    expect(error.code).toBe('config_error');
  });
});
