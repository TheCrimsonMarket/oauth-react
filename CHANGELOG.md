# Changelog

All notable changes to `@crimsoncorp/oauth-react` will be documented in this file.

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
