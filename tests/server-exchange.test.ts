import { describe, expect, it, vi } from 'vitest';
import { exchangeTcmAuthorizationCode, exchangeTcmPopupCode, fetchTcmUserInfo } from '../src/server/exchange';

describe('server exchange helpers', () => {
  it('retries token exchange with fallback redirect URI on redirect mismatch', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Redirect URI does not match',
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          access_token: 'access-1',
          refresh_token: 'refresh-1',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'profile email',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const result = await exchangeTcmAuthorizationCode(
      {
        code: 'code-1',
        state: 'state-1',
        codeVerifier: 'verifier-1',
        redirectUri: 'https://wrong.example.com/auth/tcm/popup-callback',
        provider: 'google',
      },
      {
        apiBaseUrl: 'https://api.thecrimsonmarket.com',
        clientId: 'client-1',
        clientSecret: 'secret-1',
        requestUrl: 'https://partner.example.com/api/auth/tcm/oauth-exchange',
        callbackPath: '/auth/tcm/popup-callback',
        fetch: fetchMock,
      },
    );

    expect(result.redirectUri).toBe('https://partner.example.com/auth/tcm/popup-callback');
    expect(result.tokenSet.accessToken).toBe('access-1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fetches userinfo after successful popup-code exchange', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          access_token: 'access-1',
          refresh_token: 'refresh-1',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          sub: 'user-1',
          googleId: 'google-1',
          email: 'user@example.com',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const result = await exchangeTcmPopupCode(
      {
        code: 'code-1',
        state: 'state-1',
        codeVerifier: 'verifier-1',
        redirectUri: 'https://partner.example.com/auth/tcm/popup-callback',
        provider: 'google',
      },
      {
        apiBaseUrl: 'https://api.thecrimsonmarket.com',
        clientId: 'client-1',
        clientSecret: 'secret-1',
        expectedProvider: 'google',
        fetch: fetchMock,
      },
    );

    expect(result.userInfo.googleId).toBe('google-1');
    expect(result.tokenSet.accessToken).toBe('access-1');
  });

  it('fetches userinfo directly', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sub: 'user-1', userName: 'alice' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await fetchTcmUserInfo('access-1', {
      apiBaseUrl: 'https://api.thecrimsonmarket.com',
      clientId: 'client-1',
      clientSecret: 'secret-1',
      fetch: fetchMock,
    });

    expect(result).toMatchObject({ sub: 'user-1', userName: 'alice' });
  });
});
