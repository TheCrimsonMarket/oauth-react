import { describe, expect, it, vi } from 'vitest';
import { refreshTcmAccessToken } from '../src/server/exchange';
import { isTcmOAuthServerError } from '../src/server/types';

const serverOptions = {
  apiBaseUrl: 'https://api.thecrimsonmarket.com',
  clientId: 'client-1',
  clientSecret: 'secret-1',
};

describe('refreshTcmAccessToken', () => {
  it('exchanges a refresh token and maps the response into a token set', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        access_token: 'access-2',
        refresh_token: 'refresh-2',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'profile email',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const tokenSet = await refreshTcmAccessToken('refresh-1', {
      ...serverOptions,
      fetch: fetchMock,
    });

    expect(tokenSet.accessToken).toBe('access-2');
    expect(tokenSet.refreshToken).toBe('refresh-2');
    expect(tokenSet.expiresIn).toBe(3600);
    expect(tokenSet.tokenType).toBe('Bearer');
    expect(tokenSet.scope).toBe('profile email');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.thecrimsonmarket.com/oauth/token');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from('client-1:secret-1').toString('base64')}`,
    );
    const body = new URLSearchParams(init.body as string);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('refresh-1');
  });

  it('throws a discriminable invalid_grant error for an expired refresh token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        error: 'invalid_grant',
        error_description: 'Refresh token is invalid or expired',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const error = await refreshTcmAccessToken('refresh-1', {
      ...serverOptions,
      fetch: fetchMock,
    }).catch((caught) => caught);

    expect(isTcmOAuthServerError(error)).toBe(true);
    expect(error.code).toBe('invalid_grant');
    expect(error.status).toBe(400);
  });

  it('surfaces transient/server failures distinctly from invalid_grant', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        error: 'server_error',
        error_description: 'Internal server error',
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const error = await refreshTcmAccessToken('refresh-1', {
      ...serverOptions,
      fetch: fetchMock,
    }).catch((caught) => caught);

    expect(isTcmOAuthServerError(error)).toBe(true);
    expect(error.code).not.toBe('invalid_grant');
    expect(error.status).toBeGreaterThanOrEqual(500);
  });
});
