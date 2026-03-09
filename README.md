# @crimsoncorp/oauth-react

Production-ready OAuth SDK for TCM integrations with strict PKCE/state handling and a recommended route-backed abstraction for server-backed React apps.

## Install

```bash
npm install @crimsoncorp/oauth-react
```

## Recommended Integration Path

Use the route-backed APIs for server-backed apps:
1. Browser: `useTcmOAuth` or `createTcmOAuthRouteClient`
2. Callback page: `TcmOAuthCallbackPage`
3. Server route: `createTcmOAuthExchangeRoute`

Keep the low-level APIs when you need full custom control:
1. React hook: `useTcmOAuthPopup`
2. Browser client: `createTcmOAuthPopupClient`
3. Server helpers: `@crimsoncorp/oauth-react/server`

The recommended APIs support:
1. `interactionMode: "auto" | "popup" | "redirect"`
2. `auto` defaulting to popup on desktop-like environments
3. `auto` defaulting to redirect on mobile-like environments
4. popup-to-redirect fallback when popup opening is blocked

SDK styles are opt-in:

```ts
import "@crimsoncorp/oauth-react/styles.css";
```

## Route-Backed React Quickstart

```tsx
import { useTcmOAuth } from "@crimsoncorp/oauth-react";

export function LoginButton() {
  const oauth = useTcmOAuth<{ userId: string }>({
    clientId: process.env.NEXT_PUBLIC_TCM_OAUTH_CLIENT_ID!,
    tcmWebUrl: process.env.NEXT_PUBLIC_TCM_OAUTH_WEB_URL!,
    callbackPath: "/auth/tcm/callback",
    exchangeEndpoint: "/api/auth/tcm/oauth-exchange",
    interactionMode: "auto",
    onSuccess: ({ userId }) => {
      console.log("Logged in as", userId);
    },
  });

  return (
    <button disabled={oauth.authenticating} onClick={() => void oauth.startLogin("google")}>
      {oauth.authenticating ? "Connecting..." : "Continue with Google"}
    </button>
  );
}
```

Render the callback page on your app origin:

```tsx
import { TcmOAuthCallbackPage } from "@crimsoncorp/oauth-react";

export default function Page() {
  return <TcmOAuthCallbackPage />;
}
```

## Next.js App Router Exchange Route

```ts
import { createTcmOAuthExchangeRoute } from "@crimsoncorp/oauth-react/nextjs";

const route = createTcmOAuthExchangeRoute({
  oauth: {
    apiBaseUrl: process.env.TCM_OAUTH_API_URL!,
    clientId: process.env.TCM_OAUTH_CLIENT_ID!,
    clientSecret: process.env.TCM_OAUTH_CLIENT_SECRET!,
    callbackPath: "/auth/tcm/callback",
    expectedProvider: "google",
  },
  async onResolvedUser({ userInfo }) {
    const user = await upsertUser(userInfo);
    return {
      body: { userId: user.id },
      session: { id: user.id },
    };
  },
  applySession(response, session) {
    response.headers.append("set-cookie", `app_session=${session.id}; Path=/; HttpOnly; SameSite=Lax`);
  },
});

export const { POST } = route;
```

## Public Exports

1. `@crimsoncorp/oauth-react`: React hooks/components and shared types
2. `@crimsoncorp/oauth-react/client`: browser clients
3. `@crimsoncorp/oauth-react/client/callback`: popup callback poster
4. `@crimsoncorp/oauth-react/server`: framework-neutral server exchange helpers
5. `@crimsoncorp/oauth-react/nextjs`: App Router exchange route factory
6. `@crimsoncorp/oauth-react/styles.css`: bundled UI styles

## Behavior Guarantees

1. PKCE S256, state checks, and transaction expiry are enforced in the browser flow.
2. `auto` interaction mode selects redirect on mobile-like environments and popup on desktop-like environments.
3. One active popup flow is allowed per browser window.
4. Duplicate popup starts reuse/focus the active flow.
5. Duplicate callback state is consumed once.
6. Route-backed exchange normalizes non-2xx responses into `exchange_failed`.

## Important Constraints

1. This SDK currently targets server-backed apps.
2. `Portal.Service` still requires `client_secret` at token exchange, so pure browser-only SPA exchange is not officially supported.
3. Redirect URIs must match the registered value exactly.
4. Popup-specific exports remain available for backward compatibility but are no longer the recommended integration surface.

## Docs

1. `docs/api-reference.md`
1. `docs/server-backed-nextjs.md`
2. `docs/react-client-usage.md`
3. `docs/medusa-migration.md`

## Troubleshooting

1. `popup_blocked`: login must start from a direct user gesture.
2. `popup_closed`: the user closed the popup before callback delivery.
3. `exchange_failed`: inspect your route response body and `traceId`.
4. `config_error`: verify `clientId`, `tcmWebUrl`, exact redirect URI registration, and server-side secret configuration.

