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

## 2. Exchange Route

```ts
import { createTcmOAuthExchangeRoute } from "@crimsoncorp/oauth-react/nextjs";

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
    response.headers.append(
      "set-cookie",
      `app_session=${session.id}; Path=/; HttpOnly; SameSite=Lax`,
    );
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
- local session cookie format
- response body shape

## 3. Browser Hook

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

## Notes

- Keep the callback page same-origin with the opener.
- Register the exact callback URL in the Developers UI.
- Do not expose `TCM_OAUTH_CLIENT_SECRET` to the browser.
- Popup-specific exports still exist for compatibility, but the neutral `useTcmOAuth` + `TcmOAuthCallbackPage` path is now the recommended production integration.
