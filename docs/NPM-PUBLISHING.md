# npm publication is disabled

The first release is intended for GitHub, using the included Desktop bundle.
`package.json` deliberately has `private: true`; the old upstream npm publishing workflow cannot publish anything.

Original publishing settings are retained only in Git history. Never publish a fork using the original author's scope, credentials or publisher identity.

If npm publication is requested later, choose an owned package name, review its contents and dependencies, configure your own publisher and obtain explicit approval before removing the private flag. No npm token belongs in the source tree or a public issue.

See [RELEASE.md](RELEASE.md).
