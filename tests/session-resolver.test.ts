import { describe, expect, it, vi } from 'vitest';
import { createTcmCookieSessionAdapter, resolveTcmAuthSession } from '../src/server';

describe('session resolver', () => {
  it('resolves sdk session when standalone cookie is present', () => {
    const adapter = createTcmCookieSessionAdapter({ appId: 'socialriddle' });
    const request = new Request('https://partner.example.com/api/auth/me', {
      headers: {
        cookie: `${adapter.cookieName}=signed-session`,
      },
    });

    const session = resolveTcmAuthSession(request, {
      sources: [
        {
          name: 'sdk_session',
          resolve: (currentRequest) => {
            const cookieValue = adapter.read(currentRequest);
            return cookieValue ? { sub: 'user-1', raw: cookieValue } : null;
          },
        },
        {
          name: 'parent_auth_token',
          resolve: vi.fn(() => ({ sub: 'parent-user' })),
        },
      ],
      precedence: ['sdk_session', 'parent_auth_token'],
    });

    expect(session).toEqual({
      authSource: 'sdk_session',
      raw: 'signed-session',
      sub: 'user-1',
    });
  });

  it('falls back to parent auth token when standalone session is absent', () => {
    const request = new Request('https://partner.example.com/api/auth/me', {
      headers: {
        cookie: 'authToken=shared-token',
      },
    });

    const session = resolveTcmAuthSession(request, {
      sources: [
        {
          name: 'sdk_session',
          resolve: () => null,
        },
        {
          name: 'parent_auth_token',
          resolve: () => ({ sub: 'parent-user' }),
        },
      ],
      precedence: ['sdk_session', 'parent_auth_token'],
    });

    expect(session).toEqual({
      authSource: 'parent_auth_token',
      sub: 'parent-user',
    });
  });
});
