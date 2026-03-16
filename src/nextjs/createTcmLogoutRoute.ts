import type { TcmCookieSessionAdapter } from '../server/session';

export interface CreateTcmLogoutRouteOptions<TSession extends Record<string, unknown>> {
  resolveSession: (request: Request) => Promise<(TSession & { authSource: string }) | null> | (TSession & { authSource: string }) | null;
  standaloneSessionAdapter: TcmCookieSessionAdapter;
  standaloneAuthSources?: string[];
  onSharedCookieLogout?: (context: {
    request: Request;
    session: TSession & { authSource: string };
  }) => Promise<Response | null | void> | Response | null | void;
}

function buildJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

export function createTcmLogoutRoute<TSession extends Record<string, unknown>>(
  options: CreateTcmLogoutRouteOptions<TSession>,
): { GET: (request: Request) => Promise<Response>; POST: (request: Request) => Promise<Response> } {
  const standaloneAuthSources = new Set(options.standaloneAuthSources ?? ['sdk_session']);

  async function handle(request: Request): Promise<Response> {
    const session = await options.resolveSession(request);

    if (session && !standaloneAuthSources.has(session.authSource)) {
      const delegatedResponse = await options.onSharedCookieLogout?.({
        request,
        session,
      });
      if (delegatedResponse) {
        return delegatedResponse;
      }

      return buildJsonResponse({
        success: true,
        authSource: session.authSource,
        delegated: true,
      });
    }

    const response = buildJsonResponse({
      success: true,
      authSource: session?.authSource ?? null,
      clearedStandaloneSession: Boolean(session || options.standaloneSessionAdapter.read(request)),
    });

    if (session || options.standaloneSessionAdapter.read(request)) {
      options.standaloneSessionAdapter.clear(response);
    }

    return response;
  }

  return {
    GET: handle,
    POST: handle,
  };
}
