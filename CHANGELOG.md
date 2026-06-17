# Changelog

All notable changes to `@crimsoncorp/oauth-react` will be documented in this file.

## 1.4.0 - Unreleased

### Added

- Added `refreshTcmAccessToken` server helper performing the `grant_type=refresh_token` exchange and mapping the response into the existing token-set shape.
- Added `revokeTcmToken` server helper calling the OAuth revoke endpoint with an optional token-type hint.
- Renewal failures surface a discriminable `invalid_grant` condition (via `TcmOAuthServerError.code`) distinct from transient/server errors.
- Both helpers are exported from the server entry and re-exported from the Next.js entry, with HTTP-boundary unit tests covering request shape, response mapping, and the `invalid_grant` vs. transient branches.

## 1.3.0 - Unreleased

### Added

- Added explicit OAuth interaction intent to authorize URLs.
- Added `prompt=select_provider` for `startLogin()` without a provider.
- Added `provider=<provider>&prompt=login` for explicit provider starts such as `startLogin("twitch")`.
- Added SDK tests covering chooser-mode and explicit provider URL behavior.

### Changed

- `googleOnly` now emits `provider=google` while preserving the legacy `required_provider=google` compatibility parameter.
- Updated SDK docs to describe the new provider and prompt contract.

### Fixed

- Fixed SDK popup/redirect authorize URLs dropping provider intent before the request reached the TCM OAuth provider UI.
