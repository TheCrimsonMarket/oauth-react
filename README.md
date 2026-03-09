# @thecrimsonmarket/oauth-react

Popup-first OAuth SDK for TCM providers with strict PKCE/state handling.

## Install

```bash
npm install @thecrimsonmarket/oauth-react
```

## Choose Your Integration Path

1. React app (recommended for React): use `useTcmOAuthPopup` and optional SDK UI components.
2. Vanilla browser app: use `@thecrimsonmarket/oauth-react/client`.
3. Backend exchange helpers (Node/server routes): use `@thecrimsonmarket/oauth-react/server`.

SDK styles are opt-in:

```ts
import '@thecrimsonmarket/oauth-react/styles.css';
```

## React Quickstart

```tsx
import { useTcmOAuthPopup } from '@thecrimsonmarket/oauth-react';
import '@thecrimsonmarket/oauth-react/styles.css';

export function LoginButton() {
  const oauth = useTcmOAuthPopup({
    clientId: process.env.NEXT_PUBLIC_TCM_OAUTH_CLIENT_ID!,
    tcmWebUrl: process.env.NEXT_PUBLIC_TCM_OAUTH_WEB_URL!,
    callbackPath: '/auth/tcm/popup-callback',
    exchangeCode: async (payload) => {
      const res = await fetch('/api/auth/tcm/oauth-exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Exchange failed');
      return res.json();
    },
  });

  return (
    <button disabled={oauth.authenticating} onClick={() => void oauth.startLogin('google')}>
      {oauth.authenticating ? 'Connecting...' : 'Continue with Google'}
    </button>
  );
}
```

Render callback page on your app origin:

```tsx
import { TcmPopupCallbackPage } from '@thecrimsonmarket/oauth-react';

export default function Page() {
  return <TcmPopupCallbackPage />;
}
```

Scope note:
1. Request `email` only if your app needs user email.
2. If email is not needed, pass `scope: 'profile'` in SDK options.
3. If email is requested, ensure your OAuth client has `email` in allowed scopes.

## Vanilla Browser Quickstart

```ts
import { createTcmOAuthClient } from '@thecrimsonmarket/oauth-react/client';

const oauthClient = createTcmOAuthClient({
  clientId: 'tcm_xxx',
  tcmWebUrl: 'https://www.thecrimsonmarket.com',
  callbackPath: '/auth/tcm/popup-callback',
});

document.querySelector('#login')?.addEventListener('click', async () => {
  try {
    const payload = await oauthClient.loginWithPopup({ provider: 'google' });
    const res = await fetch('/api/auth/tcm/oauth-exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Exchange failed');
    // app-specific success handling
  } catch (error) {
    // app-specific error handling
  }
});
```

For callback route in a plain HTML page:

```ts
import { postPopupCallbackResult } from '@thecrimsonmarket/oauth-react/client/callback';

postPopupCallbackResult();
```

## Server Helpers Quickstart (Next.js/Node)

```ts
import { resolvePopupRedirectUri, toPkceS256Challenge } from '@thecrimsonmarket/oauth-react/server';

const redirectUri = resolvePopupRedirectUri({
  requestUrl: req.url,
  callbackPath: '/auth/tcm/popup-callback',
  explicitRedirectUri: process.env.TCM_OAUTH_REDIRECT_URI,
});

const challenge = toPkceS256Challenge(codeVerifier);
```

## Public Exports

1. Root (`@thecrimsonmarket/oauth-react`): React hook/components and shared types.
2. Client (`@thecrimsonmarket/oauth-react/client`): framework-agnostic browser OAuth client.
3. Client callback helper (`@thecrimsonmarket/oauth-react/client/callback`): one-shot callback poster.
4. Server (`@thecrimsonmarket/oauth-react/server`): server-safe helpers for PKCE challenge and redirect URI resolution.
5. Styles (`@thecrimsonmarket/oauth-react/styles.css`): bundled SDK UI styles.

## Behavior Guarantees

1. PKCE S256, state checks, and transaction expiry are enforced.
2. One active popup flow per browser window.
3. A second `loginWithPopup` call while active reuses in-flight flow state and focuses the existing popup.
4. Duplicate callback state is consumed once.
5. Popup close emits `popup_closed` only after close-confirm window (`1200ms`) if callback is not accepted.
6. React integrations remain backward compatible in `v1.x`.

## Docs

1. API reference: `/mnt/d/dev/raum/tcm/docs/SDK_API_REFERENCE.md`
2. Next.js API route guide: `/mnt/d/dev/raum/tcm/docs/SDK_NEXTJS_API_ROUTE_GUIDE.md`
3. Vanilla client guide: `/mnt/d/dev/raum/tcm/docs/SDK_VANILLA_CLIENT_GUIDE.md`
4. Medusa migration: `/mnt/d/dev/raum/tcm/docs/SDK_MEDUSA_MIGRATION.md`
5. Validation guide: `/mnt/d/dev/raum/tcm/docs/SDK_VALIDATION_GUIDE.md`

## Troubleshooting

1. Popup blocked: ensure user gesture triggers `loginWithPopup`/`startLogin`.
2. Callback not delivered: callback route must share origin with opener and keep `window.opener` available.
3. PKCE policy errors: verify backend client is configured for S256 and exchange route forwards `codeVerifier`.
4. Windows Rollup optional dependency issue:

```bash
npm i -D @rollup/rollup-win32-x64-msvc
```
