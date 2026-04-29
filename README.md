# @crimsoncorp/oauth-react

React OAuth SDK for The Crimson Market with strict PKCE/state handling, route-backed code exchange, popup-to-redirect fallback, and a recommended server-backed integration path.

## Why This SDK

- Recommended route-backed flow for React and Next.js apps
- Automatic interaction mode selection with `interactionMode: "auto"`
- Popup-to-redirect fallback when browsers block popup opening
- Strict PKCE S256, state validation, and transaction expiry handling
- Callback helpers that support both popup and top-level redirect completion
- Server exchange route factory with diagnostics forwarding and duplicate-request deduplication

## Install

```bash
npm install @crimsoncorp/oauth-react
```

Peer dependencies:

- `react >= 18`
- `react-dom >= 18`

Bundled styles are optional:

```ts
import "@crimsoncorp/oauth-react/styles.css";
```

## When To Use This SDK

Use this SDK when:

- your app is built with React
- you want The Crimson Market OAuth sign-in flow
- your app can keep `client_secret` on the server
- you want the browser flow to use popup on desktop-like environments and redirect on mobile-like environments automatically

Do not treat this SDK as a pure browser-only SPA token exchange solution. `Portal.Service` still requires `client_secret` at token exchange time, so production integrations remain server-backed.

## Which API Should I Use?

### Recommended for most apps

- `useTcmOAuth`
- `TcmOAuthCallbackPage`
- `createTcmOAuthExchangeRoute`
- `createTcmOAuthRouteClient`

Use this path for server-backed React or Next.js apps.

### Compatibility popup path

- `useTcmOAuthPopupRoute`
- `TcmPopupCallbackPage`
- `createTcmOAuthPopupRouteClient`

Use this when preserving an older popup-only callback contract such as `/auth/tcm/popup-callback`.

### Advanced / low-level path

- `useTcmOAuthPopup`
- `createTcmOAuthClient`
- `createTcmOAuthPopupClient`
- `@crimsoncorp/oauth-react/server`
- `@crimsoncorp/oauth-react/client/callback`

Use this path when you need custom route requests, custom exchange semantics, or direct control over callback handling.

## Recommended Quickstart

### 1. Browser hook

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
    onError: (error) => {
      console.error(error.code, error.message);
    },
  });

  return (
    <>
      <button
        type="button"
        disabled={oauth.authenticating}
        onClick={() => void oauth.startLogin()}
      >
        {oauth.authenticating ? "Connecting..." : "Continue to provider chooser"}
      </button>
      <button
        type="button"
        disabled={oauth.authenticating}
        onClick={() => void oauth.startLogin("discord")}
      >
        Continue with Discord
      </button>
    </>
  );
}
```

Use `googleOnly: true` when the app should skip the provider chooser and immediately start the Google flow:

```tsx
const oauth = useTcmOAuth({
  clientId,
  tcmWebUrl,
  googleOnly: true,
});

<button onClick={() => void oauth.startLogin()}>Continue with Google</button>
```

### 2. Callback page

Render the SDK callback component on the same origin as the page that started the flow.

```tsx
import { TcmOAuthCallbackPage } from "@crimsoncorp/oauth-react";

export default function Page() {
  return <TcmOAuthCallbackPage />;
}
```

Recommended callback path:

```ts
"/auth/tcm/callback"
```

Callback behavior:

- in a popup, the callback page posts the result to the opener and attempts to close itself
- in a top-level redirect, the callback page stores the redirect result and returns to the initiating route

### 3. Next.js App Router exchange route

```ts
import { createTcmOAuthExchangeRoute } from "@crimsoncorp/oauth-react/nextjs";

const route = createTcmOAuthExchangeRoute({
  oauth: {
    apiBaseUrl: process.env.TCM_OAUTH_API_URL!,
    clientId: process.env.TCM_OAUTH_CLIENT_ID!,
    clientSecret: process.env.TCM_OAUTH_CLIENT_SECRET!,
    callbackPath: "/auth/tcm/callback",
    googleOnly: true,
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
    response.headers.append(
      "set-cookie",
      `app_session=${session.id}; Path=/; HttpOnly; SameSite=Lax`,
    );
  },
});

export const { POST } = route;
```

### 4. Environment variables

Typical server-backed setup:

```env
NEXT_PUBLIC_TCM_OAUTH_WEB_URL=https://www.thecrimsonmarket.com
TCM_OAUTH_API_URL=https://api.thecrimsonmarket.com
TCM_OAUTH_CLIENT_ID=tcm_xxx
TCM_OAUTH_CLIENT_SECRET=your-secret
```

Your app also needs:

- a registered callback URL in the Developers portal
- exact redirect URI matching between the portal client and your app
- a server-kept `client_secret`

## Install-Time Defaults And Expectations

- Recommended route-backed callback path: `/auth/tcm/callback`
- Popup compatibility callback path: `/auth/tcm/popup-callback`
- Default route exchange endpoint: `/api/auth/tcm/oauth-exchange`
- Default browser scope: `profile email`
- Default popup size: `500 x 650`
- Default diagnostics mode: `auto`

`diagnostics: "auto"` sends `x-tcm-flow-id` and `x-tcm-message-id` in development and staging-like environments.

## Interaction Model

`useTcmOAuth` and `createTcmOAuthRouteClient` support:

```ts
interactionMode: "auto" | "popup" | "redirect"
```

Recommended default:

```ts
interactionMode: "auto"
```

Behavior:

- desktop-like environments prefer popup
- mobile-like environments prefer redirect
- popup opening failure falls back to redirect unless `fallbackToRedirect` is set to `false`
- redirect flows can resume back to the initiating route via `returnTo`

## Compatibility And Advanced APIs

### Popup-only route-backed flow

Use `useTcmOAuthPopupRoute` if you want the SDK to own the POST to your exchange endpoint but keep popup-only behavior.

### Custom exchange handling

Use `useTcmOAuthPopup` when your app wants to provide its own `exchangeCode(payload)` implementation.

### Browser clients

- `createTcmOAuthRouteClient`
- `createTcmOAuthPopupRouteClient`
- `createTcmOAuthClient`
- `createTcmOAuthPopupClient`

These are useful when you want the SDK behavior outside React hooks or need explicit client control.

### Callback helpers

`@crimsoncorp/oauth-react/client/callback` exports:

- `handleOAuthCallback`
- `postPopupCallbackResult`

Use these helpers when you want to own the callback page implementation instead of rendering the built-in callback components.

### UI components

The package also exports:

- `TcmOAuthButton`
- `TcmOAuthPanel`
- `TcmOAuthCallbackPage`
- `TcmPopupCallbackPage`

## Public Entry Points

- `@crimsoncorp/oauth-react`
  React hooks, callback components, button/panel components, and shared types
- `@crimsoncorp/oauth-react/client`
  framework-agnostic browser clients
- `@crimsoncorp/oauth-react/client/callback`
  callback helpers for popup and redirect flows
- `@crimsoncorp/oauth-react/server`
  framework-neutral server helpers
- `@crimsoncorp/oauth-react/nextjs`
  App Router exchange route factory
- `@crimsoncorp/oauth-react/styles.css`
  bundled optional styles

## Server Behaviors Worth Knowing

`createTcmOAuthExchangeRoute` handles:

- payload validation and normalization
- token exchange
- userinfo fetch
- diagnostics header forwarding
- duplicate-request single-flight handling for concurrent equivalent exchanges

Your app still owns:

- user lookup or creation
- local session format and cookie behavior
- response body shape returned to the browser

If you need lower-level control, `@crimsoncorp/oauth-react/server` also exports:

- `toPkceS256Challenge`
- `resolvePopupRedirectUri`
- `exchangeTcmAuthorizationCode`
- `exchangeTcmPopupCode`
- `fetchTcmUserInfo`

## Constraints

- The primary supported path is server-backed.
- Redirect URIs must match the registered value exactly.
- Popup-only exports remain available for backward compatibility, but they are not the recommended first choice for new integrations.
- Not every listed provider is guaranteed to have identical backend support at all times.

## Troubleshooting

- `popup_blocked`
  Start login from a direct user gesture such as a button click.
- `popup_closed`
  The user closed the popup before callback delivery.
- `state_mismatch`
  The callback state did not match the stored transaction.
- `txn_missing` or `txn_expired`
  The browser transaction was lost or expired before completion.
- `exchange_failed`
  Inspect your exchange route response body and `traceId`.
- `config_error`
  Verify `clientId`, `tcmWebUrl`, exact callback registration, and server-side secret configuration.
- `unsupported_browser`
  The runtime is missing required popup, crypto, or storage APIs.

## Detailed Docs

- API reference: [`docs/api-reference.md`](./docs/api-reference.md)
- React client usage: [`docs/react-client-usage.md`](./docs/react-client-usage.md)
- Server-backed Next.js guide: [`docs/server-backed-nextjs.md`](./docs/server-backed-nextjs.md)

For client registration, redirect URI setup, and OAuth scopes, use the Developers portal documentation.
