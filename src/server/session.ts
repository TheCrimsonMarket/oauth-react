export interface TcmSessionCookieOptions {
  httpOnly?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  secure?: boolean;
  path?: string;
  domain?: string;
  maxAge?: number;
  expires?: Date;
}

export interface TcmCookieSessionAdapter {
  cookieName: string;
  maxAgeSeconds: number;
  read(request: Request): string | null;
  apply(response: Response, value: string, overrides?: Partial<TcmSessionCookieOptions>): void;
  clear(response: Response): void;
  serialize(value: string, overrides?: Partial<TcmSessionCookieOptions>): string;
}

export interface CreateTcmCookieSessionAdapterOptions {
  appId: string;
  cookieDomain?: string;
  cookiePath?: string;
  secure?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  httpOnly?: boolean;
  maxAgeSeconds?: number;
}

export interface TcmAuthSessionSource<TSession extends Record<string, unknown>> {
  name: string;
  resolve: (request: Request) => TSession | null;
}

export interface ResolveTcmAuthSessionOptions<TSession extends Record<string, unknown>> {
  sources: Array<TcmAuthSessionSource<TSession>>;
  precedence?: string[];
}

function readCookieFromHeader(request: Request, cookieName: string): string | null {
  const cookieHeader = request.headers.get('cookie') || '';
  if (!cookieHeader) return null;

  const segments = cookieHeader.split(';');
  for (const segment of segments) {
    const [rawName, ...rest] = segment.trim().split('=');
    if (!rawName || rest.length === 0) continue;
    if (rawName !== cookieName) continue;

    const rawValue = rest.join('=');
    try {
      return decodeURIComponent(String(rawValue).replace(/^"|"$/g, ''));
    } catch {
      return String(rawValue).replace(/^"|"$/g, '');
    }
  }

  return null;
}

function normalizeAppId(appId: string): string {
  return appId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'app';
}

function toCookieName(appId: string): string {
  return `tcm_session_${normalizeAppId(appId)}`;
}

function serializeCookie(name: string, value: string, options: TcmSessionCookieOptions): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  }

  if (options.domain) {
    parts.push(`Domain=${options.domain}`);
  }

  if (options.path) {
    parts.push(`Path=${options.path}`);
  }

  if (options.expires instanceof Date) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }

  if (options.httpOnly) {
    parts.push('HttpOnly');
  }

  if (options.secure) {
    parts.push('Secure');
  }

  if (options.sameSite) {
    const sameSite = String(options.sameSite).toLowerCase();
    const normalizedSameSite =
      sameSite === 'strict' ? 'Strict' : sameSite === 'none' ? 'None' : 'Lax';
    parts.push(`SameSite=${normalizedSameSite}`);
  }

  return parts.join('; ');
}

export function createTcmCookieSessionAdapter(
  options: CreateTcmCookieSessionAdapterOptions,
): TcmCookieSessionAdapter {
  const cookieName = toCookieName(options.appId);
  const defaultOptions: TcmSessionCookieOptions = {
    httpOnly: options.httpOnly ?? true,
    sameSite: options.sameSite ?? 'lax',
    secure: options.secure ?? process.env.NODE_ENV === 'production',
    path: options.cookiePath ?? '/',
    domain: options.cookieDomain,
    maxAge: options.maxAgeSeconds ?? 60 * 60 * 24,
  };

  return {
    cookieName,
    maxAgeSeconds: defaultOptions.maxAge ?? 60 * 60 * 24,
    read(request: Request): string | null {
      return readCookieFromHeader(request, cookieName);
    },
    apply(response: Response, value: string, overrides: Partial<TcmSessionCookieOptions> = {}): void {
      response.headers.append('set-cookie', serializeCookie(cookieName, value, { ...defaultOptions, ...overrides }));
    },
    clear(response: Response): void {
      response.headers.append(
        'set-cookie',
        serializeCookie(cookieName, '', {
          ...defaultOptions,
          maxAge: 0,
          expires: new Date(0),
        }),
      );
    },
    serialize(value: string, overrides: Partial<TcmSessionCookieOptions> = {}): string {
      return serializeCookie(cookieName, value, { ...defaultOptions, ...overrides });
    },
  };
}

export function resolveTcmAuthSession<TSession extends Record<string, unknown>>(
  request: Request,
  options: ResolveTcmAuthSessionOptions<TSession>,
): (TSession & { authSource: string }) | null {
  const sourceEntries = new Map(options.sources.map((source) => [source.name, source]));
  const precedence = options.precedence?.length
    ? options.precedence
    : options.sources.map((source) => source.name);

  for (const sourceName of precedence) {
    const source = sourceEntries.get(sourceName);
    if (!source) continue;

    const session = source.resolve(request);
    if (!session) continue;

    return {
      ...session,
      authSource: source.name,
    };
  }

  return null;
}
