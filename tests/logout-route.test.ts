import { describe, expect, it, vi } from 'vitest';
import { createTcmLogoutRoute } from '../src/nextjs';
import { createTcmCookieSessionAdapter } from '../src/server';

describe('createTcmLogoutRoute', () => {
  it('clears the standalone session for sdk-backed auth', async () => {
    const adapter = createTcmCookieSessionAdapter({ appId: 'socialriddle' });
    const route = createTcmLogoutRoute({
      resolveSession: () => ({ sub: 'user-1', authSource: 'sdk_session' }),
      standaloneSessionAdapter: adapter,
    });

    const response = await route.POST(
      new Request('https://partner.example.com/api/auth/logout', {
        method: 'POST',
        headers: {
          cookie: `${adapter.cookieName}=signed-session`,
        },
      }),
    );

    expect(response.headers.get('set-cookie')).toContain(`${adapter.cookieName}=`);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(await response.json()).toEqual({
      success: true,
      authSource: 'sdk_session',
      clearedStandaloneSession: true,
    });
  });

  it('delegates shared host-cookie logout without clearing standalone cookie', async () => {
    const adapter = createTcmCookieSessionAdapter({ appId: 'socialriddle' });
    const onSharedCookieLogout = vi.fn();
    const route = createTcmLogoutRoute({
      resolveSession: () => ({ sub: 'user-1', authSource: 'parent_auth_token' }),
      standaloneSessionAdapter: adapter,
      onSharedCookieLogout,
    });

    const response = await route.POST(
      new Request('https://partner.example.com/api/auth/logout', {
        method: 'POST',
        headers: {
          cookie: `${adapter.cookieName}=signed-session; authToken=shared-token`,
        },
      }),
    );

    expect(onSharedCookieLogout).toHaveBeenCalledTimes(1);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await response.json()).toEqual({
      success: true,
      authSource: 'parent_auth_token',
      delegated: true,
    });
  });
});
