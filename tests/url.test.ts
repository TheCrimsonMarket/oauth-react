import { describe, expect, it } from 'vitest';
import { buildAuthorizeUrl } from '../src/internal/url';

describe('buildAuthorizeUrl', () => {
  it('adds google-only params only when explicitly requested', () => {
    const googleUrl = new URL(buildAuthorizeUrl({
      tcmWebUrl: 'https://www.thecrimsonmarket.com',
      clientId: 'abc',
      redirectUri: 'https://partner.app/auth/tcm/popup-callback',
      scope: 'profile email',
      state: 'state-1',
      codeChallenge: 'challenge-1',
      provider: 'google',
      googleOnly: true,
    }));

    expect(googleUrl.searchParams.get('auto_start_provider')).toBeNull();
    expect(googleUrl.searchParams.get('popup_variant')).toBeNull();
    expect(googleUrl.searchParams.get('ui_mode')).toBe('popup');
    expect(googleUrl.searchParams.get('provider')).toBe('google');
    expect(googleUrl.searchParams.get('required_provider')).toBe('google');

    const standardGoogleUrl = new URL(buildAuthorizeUrl({
      tcmWebUrl: 'https://www.thecrimsonmarket.com',
      clientId: 'abc',
      redirectUri: 'https://partner.app/auth/tcm/popup-callback',
      scope: 'profile email',
      state: 'state-1',
      codeChallenge: 'challenge-1',
      provider: 'google',
      prompt: 'login',
    }));

    expect(standardGoogleUrl.searchParams.get('required_provider')).toBeNull();
    expect(standardGoogleUrl.searchParams.get('provider')).toBe('google');
    expect(standardGoogleUrl.searchParams.get('prompt')).toBe('login');

    const steamUrl = new URL(buildAuthorizeUrl({
      tcmWebUrl: 'https://www.thecrimsonmarket.com',
      clientId: 'abc',
      redirectUri: 'https://partner.app/auth/tcm/popup-callback',
      scope: 'profile email',
      state: 'state-1',
      codeChallenge: 'challenge-1',
      provider: 'steam',
      prompt: 'login',
    }));

    expect(steamUrl.searchParams.get('provider')).toBe('steam');
    expect(steamUrl.searchParams.get('auto_start_provider')).toBeNull();
    expect(steamUrl.searchParams.get('required_provider')).toBeNull();
    expect(steamUrl.searchParams.get('prompt')).toBe('login');
    expect(steamUrl.searchParams.get('ui_mode')).toBe('popup');

    const chooserUrl = new URL(buildAuthorizeUrl({
      tcmWebUrl: 'https://www.thecrimsonmarket.com',
      clientId: 'abc',
      redirectUri: 'https://partner.app/auth/tcm/popup-callback',
      scope: 'profile email',
      state: 'state-1',
      codeChallenge: 'challenge-1',
      prompt: 'select_provider',
    }));

    expect(chooserUrl.searchParams.get('provider')).toBeNull();
    expect(chooserUrl.searchParams.get('prompt')).toBe('select_provider');
  });
});
