# React Client Usage

Use `useTcmOAuthPopupRoute` when your app already has a server route for exchange.

## Basic Usage

```tsx
import { useTcmOAuthPopupRoute } from "@crimsoncorp/oauth-react";

export function GoogleLogin() {
  const oauth = useTcmOAuthPopupRoute<{ userId: string }>({
    clientId: process.env.NEXT_PUBLIC_TCM_OAUTH_CLIENT_ID!,
    tcmWebUrl: process.env.NEXT_PUBLIC_TCM_OAUTH_WEB_URL!,
    exchangeEndpoint: "/api/auth/tcm/oauth-exchange",
    callbackPath: "/auth/tcm/popup-callback",
    scope: "profile email",
    onSuccess: ({ userId }) => {
      console.log("Logged in", userId);
    },
    onError: (error) => {
      console.error(error.code, error.message);
    },
  });

  return (
    <button onClick={() => void oauth.startLogin("google")} disabled={oauth.authenticating}>
      {oauth.authenticating ? "Please wait..." : "Sign in with Google"}
    </button>
  );
}
```

## Return Shape

The hook returns:
- `authenticating`
- `phase`
- `error`
- `startLogin(provider)`
- `clearError()`

## Diagnostics

By default, route-backed exchange requests send `x-tcm-flow-id` and `x-tcm-message-id` in development and staging. Override with:

```ts
diagnostics: "always"
diagnostics: "never"
```

## Low-Level Alternative

If you need full control over the exchange request, use `useTcmOAuthPopup` and provide `exchangeCode` manually.

## Important Constraint

This hook does not make pure browser-only apps fully supported. The popup flow runs in the browser, but token exchange still belongs on your server because `Portal.Service` currently requires `client_secret`.
