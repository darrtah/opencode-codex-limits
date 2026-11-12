# Security and privacy

- Do not post tokens, OAuth callback URLs/codes, account identifiers, authentication files, databases or raw private logs in public issues.
- For a security report, contact the repository owner privately using a verified channel on their GitHub profile. If no private channel exists, open a minimal issue asking for one without exploit details or personal data.
- The plugin resolves only the active saved OpenAI OAuth connection in OpenCode. It does not contain the developer's login and does not copy authentication into the plugin folder.
- Authentication is sent to `https://chatgpt.com/backend-api/wham/usage` over HTTPS; redirects are rejected. No third-party telemetry is implemented.
- Access tokens and account metadata are used in memory on the server, not included in RPC outputs or stored in plugin files. Quota readings are cached in memory per credential. The GUI stores only display mode, language and refresh-interval preferences.
- OpenCode plugins execute trusted code with the rights of the host process. Review source and dependencies before installation. The unofficial endpoint and experimental GUI API may change.
- No guarantee of complete security, subscription support or absolute accuracy is made. Synthetic tests and pattern scans are not independent audits.
