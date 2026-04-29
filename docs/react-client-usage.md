# React Client Usage

Use `useTcmOAuth` when your app already has a server route for exchange and you want the SDK to choose popup vs redirect automatically.

## Basic Usage

```tsx
import { useTcmOAuth } from "@crimsoncorp/oauth-react";

export function LoginActions() {
  const oauth = useTcmOAuth<{ userId: string }>({
    clientId: process.env.NEXT_PUBLIC_TCM_OAUTH_CLIENT_ID!,
    tcmWebUrl: process.env.NEXT_PUBLIC_TCM_OAUTH_WEB_URL!,
    exchangeEndpoint: "/api/auth/tcm/oauth-exchange",
    callbackPath: "/auth/tcm/callback",
    scope: "profile email",
    interactionMode: "auto",
    onSuccess: ({ userId }) => {
      console.log("Logged in", userId);
    },
    onError: (error) => {
      console.error(error.code, error.message);
    },
  });

  return (
    <>
      <button onClick={() => void oauth.startLogin()} disabled={oauth.authenticating}>
        {oauth.authenticating ? "Please wait..." : "Open provider chooser"}
      </button>
      <button onClick={() => void oauth.startLogin("discord")} disabled={oauth.authenticating}>
        Continue with Discord
      </button>
    </>
  );
}
```

If the app should always start Google immediately, set `googleOnly: true` and call `startLogin()` without a provider argument.

## Return Shape

The hook returns:
- `authenticating`
- `phase`
- `error`
- `resolvedInteractionMode`
- `startLogin(provider)`
- `clearError()`

`resolvedInteractionMode` becomes `"popup"` or `"redirect"` once the SDK decides which path it is taking.

## Interaction Modes

`useTcmOAuth` supports:

```ts
interactionMode: "auto" | "popup" | "redirect"
```

Recommended default:

```ts
interactionMode: "auto"
```

Behavior:
- `auto` chooses popup on desktop-like environments
- `auto` chooses redirect on mobile-like environments
- if popup opening is blocked, the SDK falls back to redirect by default

You can disable popup fallback with:

```ts
fallbackToRedirect: false
```

If you want a specific post-login landing route for redirect flows:

```ts
returnTo: "/account"
```

## Diagnostics

By default, route-backed exchange requests send `x-tcm-flow-id` and `x-tcm-message-id` in development and staging. Override with:

```ts
diagnostics: "always"
diagnostics: "never"
```

## Callback Page

Render the SDK callback component on your app origin:

```tsx
import { TcmOAuthCallbackPage } from "@crimsoncorp/oauth-react";

export default function Page() {
  return <TcmOAuthCallbackPage />;
}
```

Recommended path:

```ts
"/auth/tcm/callback"
```

## Low-Level Alternative

If you need full control over the exchange request, use `useTcmOAuthPopup` and provide `exchangeCode` manually. If you specifically want the older popup-only route-backed behavior, `useTcmOAuthPopupRoute` remains available as a compatibility API.

## Important Constraint

This hook does not make pure browser-only apps fully supported. Popup or redirect can run in the browser, but token exchange still belongs on your server because `Portal.Service` currently requires `client_secret`.
