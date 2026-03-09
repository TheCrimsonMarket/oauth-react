# API Reference

Canonical reference for the public API surface of `@crimsoncorp/oauth-react`.

## Overview

### Entry Points

- `@crimsoncorp/oauth-react`
  - React hooks, UI components, and shared types
- `@crimsoncorp/oauth-react/client`
  - Framework-agnostic browser clients
- `@crimsoncorp/oauth-react/client/callback`
  - Popup callback poster
- `@crimsoncorp/oauth-react/server`
  - Framework-neutral server helpers and types
- `@crimsoncorp/oauth-react/nextjs`
  - Next.js App Router exchange route factory

### Recommended Abstraction Levels

- Preferred for server-backed React apps:
  - `useTcmOAuthPopupRoute`
  - `TcmPopupCallbackPage`
  - `createTcmOAuthExchangeRoute`
- Use lower-level APIs only when you need custom exchange handling:
  - `useTcmOAuthPopup`
  - `createTcmOAuthClient`
  - `exchangeTcmAuthorizationCode` / `exchangeTcmPopupCode`

### Current Constraints

- The SDK’s primary supported path is a server-backed app.
- `Portal.Service` currently requires `client_secret` for token exchange.
- Redirect URI matching is exact on the server side.
- Default popup callback path is `/auth/tcm/popup-callback`.
- Default browser scope is `profile email`.
- Route-backed browser exchange defaults to `/api/auth/tcm/oauth-exchange`.

## Root Exports

### `useTcmOAuthPopup`

- Import:
  - `import { useTcmOAuthPopup } from "@crimsoncorp/oauth-react"`
- Purpose:
  - React hook for the low-level popup flow when the app wants to provide its own `exchangeCode` implementation.
- Signature:

```ts
function useTcmOAuthPopup<TExchangeResult = unknown>(
  options: UseTcmOAuthPopupOptions<TExchangeResult>,
): UseTcmOAuthPopupReturn<TExchangeResult>;
```

- Options:
  - `clientId: string`
  - `tcmWebUrl: string`
  - `callbackPath?: string`
    - default: `/auth/tcm/popup-callback`
  - `scope?: string`
    - default: `profile email`
  - `exchangeCode(payload)`
    - required app-defined code exchange function
  - `popup?: { width?: number; height?: number }`
    - default size: `500 x 650`
  - `onSuccess?(result)`
  - `onError?(error)`
- Return:
  - `authenticating: boolean`
  - `phase: TcmOAuthPhase`
  - `error: TcmOAuthError | null`
  - `startLogin(provider): Promise<void>`
  - `clearError(): void`
- Use when:
  - your app needs full control over the route request, headers, or exchange semantics

### `useTcmOAuthPopupRoute`

- Import:
  - `import { useTcmOAuthPopupRoute } from "@crimsoncorp/oauth-react"`
- Purpose:
  - React hook for the recommended route-backed flow. The hook owns the POST to your exchange endpoint after popup success.
- Signature:

```ts
function useTcmOAuthPopupRoute<TExchangeResult = unknown>(
  options: UseTcmOAuthPopupRouteOptions<TExchangeResult>,
): UseTcmOAuthPopupRouteReturn<TExchangeResult>;
```

- Options:
  - `clientId: string`
  - `tcmWebUrl: string`
  - `exchangeEndpoint?: string`
    - default: `/api/auth/tcm/oauth-exchange`
  - `callbackPath?: string`
    - default: `/auth/tcm/popup-callback`
  - `scope?: string`
    - default: `profile email`
  - `popup?: { width?: number; height?: number }`
    - default size: `500 x 650`
  - `diagnostics?: "auto" | "always" | "never"`
    - default: `auto`
  - `fetch?: typeof fetch`
  - `onSuccess?(result)`
  - `onError?(error)`
- Return:
  - same shape as `useTcmOAuthPopup`
- Diagnostics behavior:
  - in `auto`, sends `x-tcm-flow-id` and `x-tcm-message-id` in development and staging-like environments
- Use when:
  - you want the browser side to be opinionated and simple, with the server route handling the real exchange

### `TcmOAuthButton`

- Import:
  - `import { TcmOAuthButton } from "@crimsoncorp/oauth-react"`
- Purpose:
  - Minimal provider button UI component.
- Runtime props:
  - `provider: TcmProvider`
  - `loading?: boolean`
    - default: `false`
  - `onClick(provider): void`
  - standard button attributes except raw `onClick`
- Behavior:
  - renders provider-specific default label
  - disables itself when `disabled` or `loading` is true

### `TcmOAuthPanel`

- Import:
  - `import { TcmOAuthPanel } from "@crimsoncorp/oauth-react"`
- Purpose:
  - Minimal list of provider buttons.
- Runtime props:
  - `providers?: TcmProvider[]`
    - default: all known providers
  - `loading?: boolean`
    - default: `false`
  - `onProviderClick(provider): void`

### `TcmPopupCallbackPage`

- Import:
  - `import { TcmPopupCallbackPage } from "@crimsoncorp/oauth-react"`
- Purpose:
  - Drop-in callback page component for the popup redirect URI route.
- Behavior:
  - calls `postPopupCallbackResult()` on mount
  - renders a minimal “authentication complete” message
- Use when:
  - your callback route is a React page and you want the standard popup completion behavior

## Root Shared Types

### `TcmProvider`

```ts
"google" | "steam" | "battlenet" | "discord" | "twitch" | "credentials"
```

- Meaning:
  - provider identifier used by browser flow APIs
- Note:
  - not every listed provider is guaranteed to have the same backend support today

### `TcmOAuthPhase`

```ts
"idle" | "preparing" | "interactive_provider" | "exchanging_partner" | "done" | "error"
```

- Meaning:
  - high-level state machine exposed by React hooks

### `TcmOAuthErrorCode`

```ts
"popup_blocked"
| "popup_closed"
| "state_mismatch"
| "txn_missing"
| "txn_expired"
| "provider_error"
| "exchange_failed"
| "config_error"
| "unsupported_browser"
| "unknown_error"
```

### `TcmOAuthError`

- Fields:
  - `code: TcmOAuthErrorCode`
  - `message: string`
  - `provider?: TcmProvider`
  - `cause?: unknown`

### `TcmAuthCodePayload`

- Purpose:
  - normalized browser payload returned after popup success and consumed by exchange routes
- Fields:
  - `code: string`
  - `state: string`
  - `codeVerifier: string`
  - `redirectUri: string`
  - `provider: TcmProvider`
  - `_tcmFlowId?: string`
  - `_tcmMessageId?: string`

### `TcmOAuthDiagnosticsMode`

```ts
"auto" | "always" | "never"
```

- Meaning:
  - controls whether route-backed browser requests send diagnostics headers

### `UseTcmOAuthPopupOptions<TExchangeResult>`

- Fields:
  - `clientId`
  - `tcmWebUrl`
  - `callbackPath?`
  - `scope?`
  - `exchangeCode(payload)`
  - `popup?`
  - `onSuccess?`
  - `onError?`

### `UseTcmOAuthPopupReturn<TExchangeResult>`

- Fields:
  - `authenticating`
  - `phase`
  - `error`
  - `startLogin(provider)`
  - `clearError()`

### `UseTcmOAuthPopupRouteOptions<TExchangeResult>`

- Fields:
  - `clientId`
  - `tcmWebUrl`
  - `exchangeEndpoint?`
  - `callbackPath?`
  - `scope?`
  - `popup?`
  - `diagnostics?`
  - `fetch?`
  - `onSuccess?`
  - `onError?`

### `UseTcmOAuthPopupRouteReturn<TExchangeResult>`

- Fields:
  - `authenticating`
  - `phase`
  - `error`
  - `startLogin(provider)`
  - `clearError()`

### `PopupResult`

- Success variant:

```ts
{ type: "tcm_oauth_result"; ok: true; code: string; state: string; iss?: string }
```

- Error variant:

```ts
{
  type: "tcm_oauth_result";
  ok: false;
  error: string;
  error_description?: string;
  state?: string;
  iss?: string;
}
```

- Use:
  - postMessage payload shape emitted from the popup callback page back to the opener

## Client Exports

### `createTcmOAuthClient`

- Import:
  - `import { createTcmOAuthClient } from "@crimsoncorp/oauth-react/client"`
- Purpose:
  - framework-neutral browser popup client
- Signature:

```ts
function createTcmOAuthClient(
  options: CreateTcmOAuthClientOptions,
): TcmOAuthClient;
```

- Behavior:
  - starts popup login
  - enforces PKCE/state/transaction handling in the browser
  - does not perform the app’s code exchange call

### `createTcmOAuthPopupRouteClient`

- Import:
  - `import { createTcmOAuthPopupRouteClient } from "@crimsoncorp/oauth-react/client"`
- Purpose:
  - framework-neutral browser client that also POSTs the payload to an exchange route
- Signature:

```ts
function createTcmOAuthPopupRouteClient<TExchangeResult = unknown>(
  options: CreateTcmOAuthPopupRouteClientOptions<TExchangeResult>,
): TcmOAuthPopupRouteClient<TExchangeResult>;
```

- Behavior:
  - wraps `createTcmOAuthClient`
  - adds `exchangeCodeViaRoute(payload)`
  - adds `loginWithPopupRoute({ provider })`

## Client Types

### `CreateTcmOAuthClientOptions`

- Fields:
  - `clientId: string`
  - `tcmWebUrl: string`
  - `callbackPath?: string`
  - `scope?: string`
  - `popup?: { width?: number; height?: number }`

### `CreateTcmOAuthPopupRouteClientOptions<TExchangeResult>`

- Extends:
  - `CreateTcmOAuthClientOptions`
- Adds:
  - `exchangeEndpoint?: string`
    - default: `/api/auth/tcm/oauth-exchange`
  - `diagnostics?: TcmOAuthDiagnosticsMode`
    - default: `auto`
  - `fetch?: typeof fetch`

### `TcmOAuthClientPhase`

```ts
"idle" | "preparing" | "interactive_provider" | "awaiting_code_exchange" | "done" | "error"
```

- Meaning:
  - browser-client-oriented phase naming

### `TcmOAuthClientSnapshot`

- Fields:
  - `phase: TcmOAuthClientPhase`
  - `error: TcmOAuthError | null`
  - `activeProvider: TcmProvider | null`
  - `flowId: string | null`
  - `authenticating: boolean`

### `TcmOAuthPopupLoginParams`

- Fields:
  - `provider: TcmProvider`

### `TcmOAuthClient`

- Methods:
  - `loginWithPopup(params): Promise<TcmAuthCodePayload>`
  - `clearError(): void`
  - `subscribe(listener): () => void`
  - `getSnapshot(): TcmOAuthClientSnapshot`
  - `focusActivePopup(): boolean`

### `TcmOAuthPopupRouteClient<TExchangeResult>`

- Extends:
  - `TcmOAuthClient`
- Adds:
  - `exchangeCodeViaRoute(payload): Promise<TExchangeResult>`
  - `loginWithPopupRoute(params): Promise<TExchangeResult>`

## Callback Export

### `postPopupCallbackResult`

- Import:
  - `import { postPopupCallbackResult } from "@crimsoncorp/oauth-react/client/callback"`
- Purpose:
  - posts popup callback query result to `window.opener`
- Use when:
  - you need a non-React or custom callback page implementation

### `PostPopupCallbackResultOptions`

- Exported from:
  - `@crimsoncorp/oauth-react/client/callback`
- Purpose:
  - options for overriding search string or close timing in callback posting

## Server Exports

### `toPkceS256Challenge`

- Import:
  - `import { toPkceS256Challenge } from "@crimsoncorp/oauth-react/server"`
- Signature:

```ts
function toPkceS256Challenge(codeVerifier: string): string;
```

- Purpose:
  - derive the RFC7636 S256 code challenge from a verifier
- Throws:
  - `TypeError` if verifier is empty

### `resolvePopupRedirectUri`

- Import:
  - `import { resolvePopupRedirectUri } from "@crimsoncorp/oauth-react/server"`
- Signature:

```ts
function resolvePopupRedirectUri(input: ResolvePopupRedirectUriInput): string;
```

- Purpose:
  - resolve the callback URI from request origin or explicit override

### `exchangeTcmAuthorizationCode`

- Import:
  - `import { exchangeTcmAuthorizationCode } from "@crimsoncorp/oauth-react/server"`
- Signature:

```ts
function exchangeTcmAuthorizationCode(
  payload: TcmAuthCodePayload,
  options: ExchangeTcmAuthorizationCodeOptions,
): Promise<ExchangeTcmAuthorizationCodeResult>;
```

- Purpose:
  - exchange authorization code for token set
- Behavior:
  - validates required payload fields
  - resolves redirect URI candidates
  - retries on redirect URI mismatch when a fallback candidate exists
- Throws:
  - `TcmOAuthServerError`

### `fetchTcmUserInfo`

- Import:
  - `import { fetchTcmUserInfo } from "@crimsoncorp/oauth-react/server"`
- Signature:

```ts
function fetchTcmUserInfo(
  accessToken: string,
  options: TcmOAuthServerOptions & { traceId?: string },
): Promise<TcmOAuthUserInfo>;
```

### `exchangeTcmPopupCode`

- Import:
  - `import { exchangeTcmPopupCode } from "@crimsoncorp/oauth-react/server"`
- Signature:

```ts
function exchangeTcmPopupCode(
  payload: TcmAuthCodePayload,
  options: ExchangeTcmPopupCodeOptions,
): Promise<TcmOAuthExchangeResult>;
```

- Purpose:
  - full popup payload exchange helper
- Behavior:
  - optionally enforces `expectedProvider`
  - exchanges code
  - fetches userinfo
- Throws:
  - `TcmOAuthServerError`

### `TcmOAuthServerError`

- Purpose:
  - standardized server-side error class used by exchange helpers
- Fields:
  - `message`
  - `status`
  - `code?`
  - `traceId?`
  - `details?`

### `isTcmOAuthServerError`

- Signature:

```ts
function isTcmOAuthServerError(error: unknown): error is TcmOAuthServerError;
```

## Server Types

### `ResolvePopupRedirectUriInput`

- Fields:
  - `requestUrl: string`
  - `callbackPath?: string`
  - `explicitRedirectUri?: string`

### `TcmOAuthServerOptions`

- Fields:
  - `apiBaseUrl: string`
  - `clientId: string`
  - `clientSecret: string`
  - `callbackPath?: string`
  - `redirectUri?: string`
  - `fetch?: typeof fetch`

### `ExchangeTcmAuthorizationCodeOptions`

- Extends:
  - `TcmOAuthServerOptions`
- Adds:
  - `requestUrl?: string`
  - `traceId?: string`

### `ExchangeTcmAuthorizationCodeResult`

- Fields:
  - `tokenSet: TcmOAuthTokenSet`
  - `redirectUri: string`
  - `traceId: string`

### `ExchangeTcmPopupCodeOptions`

- Extends:
  - `ExchangeTcmAuthorizationCodeOptions`
- Adds:
  - `expectedProvider?: TcmProvider`

### `TcmOAuthTokenSet`

- Fields:
  - `accessToken: string`
  - `refreshToken?: string`
  - `expiresIn?: number`
  - `tokenType?: string`
  - `scope?: string`
  - `raw: Record<string, unknown>`

### `TcmOAuthUserInfo`

- Shape:
  - extensible record from `/oauth/userinfo`
- Common fields:
  - `sub?`
  - `tcmid?`
  - `userName?`
  - `displayName?`
  - `email?`
  - `avatarUrl?`
  - `googleId?`

### `TcmOAuthCorrelationContext`

- Fields:
  - `enabled: boolean`
  - `flowId: string | null`
  - `messageId: string | null`

### `TcmOAuthExchangeResult`

- Fields:
  - `tokenSet: TcmOAuthTokenSet`
  - `userInfo: TcmOAuthUserInfo`
  - `provider: TcmProvider`
  - `redirectUri: string`
  - `traceId: string`

## Next.js Export

### `createTcmOAuthExchangeRoute`

- Import:
  - `import { createTcmOAuthExchangeRoute } from "@crimsoncorp/oauth-react/nextjs"`
- Signature:

```ts
function createTcmOAuthExchangeRoute<TSession = unknown, TBody = unknown>(
  options: CreateTcmOAuthExchangeRouteOptions<TSession, TBody>,
): { POST: (req: Request) => Promise<Response> };
```

- Purpose:
  - create an App Router-compatible `POST` handler for route-backed exchange
- Factory-owned behavior:
  - request parsing
  - diagnostics header forwarding
  - single-flight duplicate suppression
  - popup payload exchange
  - standardized JSON error responses
- App-owned behavior:
  - user lookup/upsert in `onResolvedUser`
  - session issuance in `applySession`

## Next.js Type

### `CreateTcmOAuthExchangeRouteOptions<TSession, TBody>`

- Fields:
  - `oauth`
    - `apiBaseUrl`
    - `clientId`
    - `clientSecret`
    - `callbackPath?`
    - `redirectUri?`
    - `fetch?`
    - `expectedProvider?`
  - `diagnostics?: "auto" | "always" | "never"`
  - `onResolvedUser(context)`
    - returns `{ body, session?, status?, headers? }`
  - `applySession?(response, session, context)`

### `onResolvedUser` Context

- Fields:
  - `userInfo: TcmOAuthUserInfo`
  - `tokenSet: TcmOAuthTokenSet`
  - `request: Request`
  - `traceId: string`
  - `correlation: TcmOAuthCorrelationContext`
  - `redirectUri: string`
  - `provider: TcmProvider`
  - `payload: TcmAuthCodePayload`

## Error Codes and Failure Semantics

### Browser Flow Errors

- `popup_blocked`
  - popup could not be opened
- `popup_closed`
  - user closed popup before successful callback handling
- `state_mismatch`
  - callback state did not match stored transaction state
- `txn_missing`
  - transaction was missing when callback arrived
- `txn_expired`
  - transaction lifetime expired before completion
- `provider_error`
  - provider returned an error callback result
- `exchange_failed`
  - route-backed or app-defined exchange failed
- `config_error`
  - missing config or unsupported provider/policy
- `unsupported_browser`
  - missing required browser APIs
- `unknown_error`
  - uncategorized startup/runtime failure

### Server Errors

- `exchangeTcmAuthorizationCode`, `fetchTcmUserInfo`, and `exchangeTcmPopupCode` throw `TcmOAuthServerError`
- `createTcmOAuthExchangeRoute` converts thrown server errors into JSON responses with:
  - `message`
  - optional `error`
  - optional `traceId`

## Defaults and Behavioral Guarantees

- Default callback path:
  - `/auth/tcm/popup-callback`
- Default browser scope:
  - `profile email`
- Default route-backed exchange endpoint:
  - `/api/auth/tcm/oauth-exchange`
- Default popup size:
  - width `500`
  - height `650`
- Default diagnostics mode:
  - `auto`
- Flow guarantees:
  - one active popup flow per browser window
  - duplicate popup starts reuse/focus the active flow
  - callback state is consumed once
  - route-backed exchange normalizes non-2xx route failures into `exchange_failed`

## Related Docs

- `docs/server-backed-nextjs.md`
- `docs/react-client-usage.md`

