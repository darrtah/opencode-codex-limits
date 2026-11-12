# GitHub release checklist

No public push, fork creation or npm publication has been performed by this preparation.

1. Choose the GitHub owner and repository name. Create a real fork of AISlop-Inc/provider-usage so the original history/attribution remains visible.
2. Inspect `git status --short` and `git diff`. Do not add the parent folder, personal OpenCode configuration, logs, authentication files, screenshots containing account data, or one-off migration helpers.
3. Run `npm ci --ignore-scripts`, `npm test`, `npm run bundle`, `npm run check`, `npm run scan` and `npm pack --dry-run --ignore-scripts`.
4. Confirm only a single copy of `provider-usage` is installed. Manually test the panel, remaining/used toggle, weekly tooltip and switching accounts. Synthetic tests cover failure recovery but a real network-failure UI test is still recommended.
5. Review runtime/build dependencies and `npm audit`. Confirm the generated GUI comes only from the checked-in source and the build is reproducible.
6. One-off migration helpers are ignored and must not be force-added. The historical npm workflow is disabled. Use npm/package-lock.json for current development; bun.lock belongs to upstream history and is not used by CI. Old provider implementations remain in upstream Git history; they are not executed or shipped by this version.
7. Set your actual repository metadata only after choosing the owner. Do not publish under the original author's npm scope. Keep `private: true` until npm publication is explicitly planned.
8. Preserve LICENSE and NOTICE.md. Add a sanitized screenshot (no email, account names, tokens or private paths) if desired.
9. Review commit author metadata (name/email), commit the release, and verify the destination remote with `git remote -v`. `origin` currently refers to the original author's repository; do not push there.
10. Obtain explicit approval before publishing the repository. Push only this repository, not its parent project. Publish v0.1.1 with limitations and tested configuration listed in README.

## Rollback

Remove only the plugin entry from the user's global `plugins` array. OpenCode reloads configuration; `/reload` can force a reload. No account logout, database edit, chat deletion or filesystem rollback is needed.
