import { describe, expect, it } from 'vitest';
import { buildAuthorizeUrl } from '../src/internal/url';

describe('buildAuthorizeUrl', () => {
  it('adds only the standardized popup params for google', () => {
    const googleUrl = new URL(buildAuthorizeUrl({
      tcmWebUrl: 'https://www.thecrimsonmarket.com',
      clientId: 'abc',
      redirectUri: 'https://partner.app/auth/tcm/popup-callback',
      scope: 'profile email',
      state: 'state-1',
      codeChallenge: 'challenge-1',
      provider: 'google',
    }));

    expect(googleUrl.searchParams.get('provider')).toBeNull();
    expect(googleUrl.searchParams.get('auto_start_provider')).toBeNull();
    expect(googleUrl.searchParams.get('popup_variant')).toBeNull();
    expect(googleUrl.searchParams.get('ui_mode')).toBe('popup');
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

    expect(steamUrl.searchParams.get('provider')).toBeNull();
    expect(steamUrl.searchParams.get('auto_start_provider')).toBeNull();
    expect(steamUrl.searchParams.get('required_provider')).toBeNull();
    expect(steamUrl.searchParams.get('ui_mode')).toBe('popup');
  });
});
