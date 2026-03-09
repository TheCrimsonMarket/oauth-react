import { describe, expect, it } from 'vitest';
import { buildAuthorizeUrl } from '../src/internal/url';

describe('buildAuthorizeUrl', () => {
  it('adds google popup params only for google provider', () => {
    const googleUrl = new URL(buildAuthorizeUrl({
      tcmWebUrl: 'https://www.thecrimsonmarket.com',
      clientId: 'abc',
      redirectUri: 'https://partner.app/auth/tcm/popup-callback',
      scope: 'profile email',
      state: 'state-1',
      codeChallenge: 'challenge-1',
      provider: 'google',
    }));

    expect(googleUrl.searchParams.get('auto_start_provider')).toBe('google');
    expect(googleUrl.searchParams.get('required_provider')).toBe('google');

    const steamUrl = new URL(buildAuthorizeUrl({
      tcmWebUrl: 'https://www.thecrimsonmarket.com',
      clientId: 'abc',
      redirectUri: 'https://partner.app/auth/tcm/popup-callback',
      scope: 'profile email',
      state: 'state-1',
      codeChallenge: 'challenge-1',
      provider: 'steam',
    }));

    expect(steamUrl.searchParams.get('auto_start_provider')).toBeNull();
    expect(steamUrl.searchParams.get('required_provider')).toBeNull();
  });
});
