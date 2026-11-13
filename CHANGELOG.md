# Changelog

## 0.2.1

- Refresh Codex limits automatically when the active OpenAI account changes.
- Hide previous readings while refreshing and discard responses from earlier switches.

## 0.2.0

- Russian / English language selector in the detail panel.
- Persisted refresh interval: 30 seconds, 1, 2, 5 or 10 minutes. Error retry remains 30 seconds.
- Additional preference/translation/cache tests (19 offline tests total).

## 0.1.1

- Rename the development build command to `bundle` so OpenCode 2.2.7 can install the prebuilt plugin from a Git repository without npm Git-dependency preparation.

## 0.1.0 — release candidate

- Codex-only Russian-language Desktop interface.
- Five-hour remaining percentage, reset date/time, alternate window in hover tooltip.
- Correct labels for non-five-hour periods and explicit missing-data state.
- Clear remaining/used toggle and labels in the detail panel.
- Per-account in-memory cache; stale warnings and ~30-second retry after errors.
- Removed Go, Claude, xAI and local authentication-file access.
- Reproducible Vite build, offline tests and working-tree/history pattern scan.

Real-account validation: Windows, OpenCode Desktop 2.2.7, Codex legacy device-code login, Plus. Other subscriptions/platforms remain unverified.
