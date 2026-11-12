# Local release-candidate validation

Validated on 2026-11-12. This is a development report, not an independent security audit.

## Passed

- 16 offline Node tests: arbitrary/missing quota windows, timestamp parsing, percentage validation, five-minute success cache, thirty-second retry, stale warning and recovery, independent account caches, redacted RPC output, GET-only fixed-endpoint transport and rejecting data received during an account switch.
- Vite build using the official OpenCode GUI preset. The two consecutive builds produced identical SHA-256 digests.
- Entrypoint/syntax checks; generated bundle contains no Japanese text.
- Pattern scan of all non-ignored working files and 22 reachable historical Git blobs found no typical keys, JWTs, private keys or personal home paths.
- `npm pack --dry-run --ignore-scripts` showed 11 intended package files, without credentials, logs, personal configuration or migration scripts.
- A real Codex Plus quota request succeeded in OpenCode Desktop 2.2.7 on Windows through the active legacy device-code account. No account was switched for validation.

## Dependency audit

After upgrading the build dependencies to Vite 7.3.8 and Solid 1.9.19, npm audit reported **0 critical, 0 high, 24 moderate and 1 low** findings in the installed dependency graph. Many moderate findings are transitive through the pinned OpenCode SDK and its utility/package-management dependencies; the low finding concerned esbuild's Windows development server.

The GUI uses the host-provided Solid/OpenCode runtime rather than bundling copies. This does not certify or patch the host application. No development server is used for the production build. Do not equate a passing build or a pattern scan with absence of exploitable vulnerabilities. Re-run the audit before release and review upstream SDK fixes; avoid untested forced dependency overrides.

## Not verified

- Actual GitHub Actions execution (nothing has been pushed).
- Real accounts without five-hour windows, other paid tiers or operating systems.
- Independent security review, external automated scanner, pixel/UI automation and a real network-failure UI test of the rebuilt release candidate.
- Exact impact of usage-endpoint requests on OpenAI service limits.

One-off migration scripts remain locally ignored; they are not release inputs. The current source and official build preset are authoritative. Git history still attributes and contains the original project's implementation.
