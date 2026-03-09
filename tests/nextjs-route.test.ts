import { describe, expect, it, vi } from 'vitest';
import { createTcmOAuthExchangeRoute } from '../src/nextjs';

describe('createTcmOAuthExchangeRoute', () => {
  it('deduplicates concurrent exchanges and applies session per response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'access-1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ sub: 'user-1', googleId: 'google-1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const onResolvedUser = vi.fn(async ({ userInfo }) => ({
      body: { message: 'ok', userId: userInfo.googleId },
      session: { sessionId: 'session-1' },
    }));
    const applySession = vi.fn((response: Response) => {
      response.headers.append('set-cookie', 'lld_session=session-1; Path=/; HttpOnly');
    });

    const route = createTcmOAuthExchangeRoute({
      oauth: {
        apiBaseUrl: 'https://api.thecrimsonmarket.com',
        clientId: 'client-1',
        clientSecret: 'secret-1',
        expectedProvider: 'google',
        fetch: fetchMock,
      },
      diagnostics: 'always',
      onResolvedUser,
      applySession,
    });

    const requestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tcm-flow-id': 'flow-1',
        'x-tcm-message-id': 'msg-1',
      },
      body: JSON.stringify({
        code: 'code-1',
        state: 'state-1',
        codeVerifier: 'verifier-1',
        redirectUri: 'https://partner.example.com/auth/tcm/popup-callback',
        provider: 'google',
      }),
    };

    const req1 = new Request('https://partner.example.com/api/auth/tcm/oauth-exchange', requestInit);
    const req2 = new Request('https://partner.example.com/api/auth/tcm/oauth-exchange', requestInit);

    const [res1, res2] = await Promise.all([route.POST(req1), route.POST(req2)]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onResolvedUser).toHaveBeenCalledTimes(1);
    expect(applySession).toHaveBeenCalledTimes(2);
    expect(await res1.json()).toEqual({ message: 'ok', userId: 'google-1' });
    expect(res1.headers.get('x-tcm-flow-id')).toBe('flow-1');
    expect(res2.headers.get('x-tcm-message-id')).toBe('msg-1');
  });
});
