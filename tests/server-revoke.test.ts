import { describe, expect, it, vi } from 'vitest';
import { revokeTcmToken } from '../src/server/exchange';
import { isTcmOAuthServerError } from '../src/server/types';

const serverOptions = {
  apiBaseUrl: 'https://api.thecrimsonmarket.com',
  clientId: 'client-1',
  clientSecret: 'secret-1',
};

describe('revokeTcmToken', () => {
  it('issues a revoke request for the supplied token with a type hint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await revokeTcmToken('refresh-1', {
      ...serverOptions,
      tokenTypeHint: 'refresh_token',
      fetch: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.thecrimsonmarket.com/oauth/revoke');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from('client-1:secret-1').toString('base64')}`,
    );
    const body = new URLSearchParams(init.body as string);
    expect(body.get('token')).toBe('refresh-1');
    expect(body.get('token_type_hint')).toBe('refresh_token');
  });

  it('throws a server error when revocation fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        error: 'invalid_client',
        error_description: 'Client authentication failed',
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const error = await revokeTcmToken('refresh-1', {
      ...serverOptions,
      fetch: fetchMock,
    }).catch((caught) => caught);

    expect(isTcmOAuthServerError(error)).toBe(true);
    expect(error.status).toBe(401);
  });
});
