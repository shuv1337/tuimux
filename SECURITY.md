# Security

## Dependency security

tuimux uses [Bun](https://bun.sh/) as its runtime and package manager.

[Socket](https://socket.dev/) provides supply-chain security analysis for npm, npx, pnpm, and yarn via its package-manager wrapper, but **the wrapper does not cover `bun install`**. As a result, local and CI `bun install` invocations are not intercepted by the Socket CLI wrapper.

**Mitigation:** The [Socket GitHub App](https://github.com/apps/socket-security) is used for PR-level dependency scanning. Any pull request that adds or updates dependencies in `package.json` / `bun.lock` is scanned by Socket before merge. This is the primary gate against malicious or high-risk packages.

**Intentional trade-off:** Bun is this project's runtime and build tool; switching package managers solely to gain wrapper coverage is not planned. The Socket GitHub App scan on PRs is treated as the sufficient control point.

If you discover a security vulnerability in tuimux itself (not a dependency), please open a GitHub issue or contact the maintainer directly.
