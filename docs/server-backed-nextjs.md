# Server-Backed Next.js Integration

This is the recommended integration path for `@crimsoncorp/oauth-react`.

## Requirements

- Next.js App Router
- A callback page on the same origin as the opener
- A server route that can keep `TCM_OAUTH_CLIENT_SECRET` private

## Environment

```env
NEXT_PUBLIC_TCM_OAUTH_CLIENT_ID=tcm_xxx
NEXT_PUBLIC_TCM_OAUTH_WEB_URL=https://www.thecrimsonmarket.com
TCM_OAUTH_API_URL=https://api.thecrimsonmarket.com
TCM_OAUTH_CLIENT_ID=tcm_xxx
TCM_OAUTH_CLIENT_SECRET=your-secret
TCM_OAUTH_REDIRECT_URI=https://your-app.example.com/auth/tcm/callback
```

## 1. Callback Page

```tsx
import { TcmOAuthCallbackPage } from "@crimsoncorp/oauth-react";

export default function Page() {
  return <TcmOAuthCallbackPage />;
}
```

Mount this at `/auth/tcm/callback`.

## 2. Exchange Route and Session Adapter

```ts
import {
  createTcmCookieSessionAdapter,
  resolveTcmAuthSession,
} from "@crimsoncorp/oauth-react/server";
import {
  createTcmLogoutRoute,
  createTcmOAuthExchangeRoute,
} from "@crimsoncorp/oauth-react/nextjs";

const sessionAdapter = createTcmCookieSessionAdapter({
  appId: "my-app",
  maxAgeSeconds: 60 * 60 * 24,
});

const route = createTcmOAuthExchangeRoute({
  oauth: {
    apiBaseUrl: process.env.TCM_OAUTH_API_URL!,
    clientId: process.env.TCM_OAUTH_CLIENT_ID!,
    clientSecret: process.env.TCM_OAUTH_CLIENT_SECRET!,
    callbackPath: "/auth/tcm/callback",
    redirectUri: process.env.TCM_OAUTH_REDIRECT_URI,
    expectedProvider: "google",
  },
  async onResolvedUser({ userInfo, traceId }) {
    if (!userInfo.googleId) {
      return {
        status: 400,
        body: { message: "Missing googleId", traceId },
      };
    }

    const user = await upsertUserFromTcm(userInfo);

    return {
      body: { userId: user.id, email: user.email },
      session: { id: user.id },
    };
  },
  applySession(response, session) {
    sessionAdapter.apply(response, session.id);
  },
});

export const { POST } = route;
```

`createTcmOAuthExchangeRoute` owns:
- payload validation
- redirect URI resolution and retry
- token exchange
- userinfo fetch
- correlation header forwarding
- duplicate-request single-flight handling

Your app still owns:
- user creation or lookup
- session payload signing and verification
- response body shape

## 3. Runtime Auth Resolution

Mixed-mode apps should resolve auth per request instead of choosing a global build-time auth mode.

```ts
function readStandaloneSession(request: Request) {
  const cookieValue = sessionAdapter.read(request);
  return cookieValue ? { sub: cookieValue } : null;
}

function readParentAuthToken(request: Request) {
  const hasParentCookie = request.headers.get("cookie")?.includes("authToken=");
  return hasParentCookie ? { sub: "host-user-id" } : null;
}

export function getSessionFromRequest(request: Request) {
  return resolveTcmAuthSession(request, {
    sources: [
      { name: "sdk_session", resolve: readStandaloneSession },
      { name: "parent_auth_token", resolve: readParentAuthToken },
    ],
    precedence: ["sdk_session", "parent_auth_token"],
  });
}
```

Recommended behavior:
- standalone apps use only `sdk_session`
- embedded shared-domain apps keep host-owned `authToken`
- mixed-mode apps like `socialriddle` resolve `sdk_session` first and fall back to `parent_auth_token`

## 4. Logout Route

```ts
const logoutRoute = createTcmLogoutRoute({
  resolveSession: getSessionFromRequest,
  standaloneSessionAdapter: sessionAdapter,
  onSharedCookieLogout() {
    return Response.json({
      success: true,
      authSource: "parent_auth_token",
      delegated: true,
    });
  },
});

export const { GET, POST } = logoutRoute;
```

Behavior:
- `sdk_session` clears the SDK-managed standalone cookie
- `parent_auth_token` delegates to host/platform logout logic and does not clear the standalone cookie

## 5. Browser Hook

```tsx
import { useTcmOAuth } from "@crimsoncorp/oauth-react";

export function LoginButton() {
  const oauth = useTcmOAuth<{ userId: string }>({
    clientId: process.env.NEXT_PUBLIC_TCM_OAUTH_CLIENT_ID!,
    tcmWebUrl: process.env.NEXT_PUBLIC_TCM_OAUTH_WEB_URL!,
    exchangeEndpoint: "/api/auth/tcm/oauth-exchange",
    callbackPath: "/auth/tcm/callback",
    interactionMode: "auto",
  });

  return (
    <button onClick={() => void oauth.startLogin("google")} disabled={oauth.authenticating}>
      {oauth.authenticating ? "Signing in..." : "Continue with Google"}
    </button>
  );
}
```

## Interaction Behavior

Recommended behavior:
- use `interactionMode: "auto"`
- let the SDK choose popup on desktop-like environments
- let the SDK choose redirect on mobile-like environments
- allow the default popup-to-redirect fallback when popup opening is blocked

This keeps the app integration simple while making mobile web and privacy-restricted environments more reliable.

## Popup Contract

For Google popup flows, the SDK now standardizes the authorize URL down to:
- OAuth protocol params
- `ui_mode=popup`
- `required_provider=google`

UI-specific popup params such as `provider`, `auto_start_provider`, and `popup_variant` are no longer part of the standard SDK contract. `service.core-ui` is expected to:
- show its own minimal spinner shell for popup login
- silently preflight `/oauth/authorize`
- redirect the popup window itself to Google when the backend returns `401` or `provider_link_required`
- show consent only when the backend returns consent payload

## Notes

- Keep the callback page same-origin with the opener.
- Register the exact callback URL in the Developers UI.
- Do not expose `TCM_OAUTH_CLIENT_SECRET` to the browser.
- Use `createTcmCookieSessionAdapter` so the SDK owns standalone session cookie naming and clearing.
- Embedded shared-domain `authToken` remains host-owned and is not replaced by the SDK cookie adapter.
- Popup-specific exports still exist for compatibility, but the neutral `useTcmOAuth` + `TcmOAuthCallbackPage` path is now the recommended production integration.
