import { describe, expect, it } from 'vitest';
import { resolvePopupRedirectUri } from '../src/server/redirect';

describe('resolvePopupRedirectUri', () => {
  it('uses explicit redirect URI when provided', () => {
    const uri = resolvePopupRedirectUri({
      requestUrl: 'https://app.example.com/api/auth/tcm/oauth-exchange',
      explicitRedirectUri: 'https://override.example.com/auth/tcm/popup-callback',
    });

    expect(uri).toBe('https://override.example.com/auth/tcm/popup-callback');
  });

  it('builds redirect URI from request origin and callback path', () => {
    const uri = resolvePopupRedirectUri({
      requestUrl: 'https://app.example.com/api/auth/tcm/oauth-exchange',
      callbackPath: '/auth/tcm/popup-callback',
    });

    expect(uri).toBe('https://app.example.com/auth/tcm/popup-callback');
  });

  it('uses default callback path', () => {
    const uri = resolvePopupRedirectUri({
      requestUrl: 'https://app.example.com/api/auth/tcm/oauth-exchange',
    });

    expect(uri).toBe('https://app.example.com/auth/tcm/popup-callback');
  });
});
