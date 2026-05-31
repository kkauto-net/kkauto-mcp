# Release Guide

This package publishes `@kkauto/kkauto-mcp` through npm Trusted Publisher from GitHub Actions.

## Trusted Publisher

npm must trust this GitHub workflow:

| Setting | Value |
| --- | --- |
| Provider | GitHub Actions |
| Repository | `kkauto-net/kkauto-mcp` |
| Workflow filename | `npm-publish-mcp.yml` |
| Environment | blank for MVP |
| Permission | `npm publish` |

The workflow uses OIDC with `permissions.id-token: write`. Do not add `NPM_TOKEN` or other long-lived npm tokens.

## Release Steps

1. Bump the package version in `package.json` and `package-lock.json`.
2. Run validation:

```bash
npm ci
npm test
npm pack --dry-run
```

3. Commit and push to `main`.
4. Create a GitHub Release with tag `v<package.json version>`, for example `v0.3.6`.
5. Wait for `.github/workflows/npm-publish-mcp.yml` to publish through npm Trusted Publisher.
6. Verify npm metadata:

```bash
npm view @kkauto/kkauto-mcp version repository keywords bin dist.tarball
npm dist-tag ls @kkauto/kkauto-mcp
```

## Guardrails

- The release tag must exactly match `v<package.json version>`.
- The package version must not already exist on npm.
- Manual dispatch is restricted to `main` and requires confirming `@kkauto/kkauto-mcp`.
- If a protected GitHub Environment is added later, configure the same environment name in npm Trusted Publisher.
