---
title: Continuous Deployment
description: The scaffold's pipeline (CI, integration deploys, gated production) and how secrets reach it.
---

Every scaffolded workspace ships a working three-stage pipeline in `.github/workflows/`. You configure secrets once; after that, merging to `main` tests and ships.

## The pipeline

**`ci.yml`** runs on every push and pull request: `npm ci`, then `npm run ci` (typecheck → lint → format check → unit tests). It is hermetic: no secrets, no environments.

**`integration.yml`** runs on merge to `main`: it restores the workspace secrets, deploys everything to the `Integration` environment, then runs the full integration suite against it:

```
npm run base -- deploy --environment Integration --all-workers
npm run base -- test --environment Integration --all-workers
```

**`deploy-production.yml`** runs when _Integration Test_ completes successfully on `main` (or manually via workflow dispatch):

```
npm run base -- deploy --environment Production --all-workers
```

Production still enforces its own gates inside the deploy: clean tree (trivially true in CI), per-worker checks, released migrations. Every worker in scope then deploys, binding targets before their binders; wrangler publishes are idempotent, so redeploying an unchanged worker is safe.

## Getting secrets into CI

Your `env.toml` files are gitignored, so CI can't read them from the repo. The CLI moves them as GitHub Actions secrets:

```bash
export GITHUB_API_TOKEN=<a token with repo scope>
npx base workspace secrets export --repo your-org/your-app
```

This gathers every `env.toml` and `test.env.toml` in the workspace, encrypts them with the repository's Actions public key, and uploads two secrets: `ENV_TOML` and `TEST_ENV_TOML`. The workflows' first step (`configure-project`) decodes them back onto disk, and from there everything behaves exactly as it does locally, including the Cloudflare credentials riding inside `env.toml`, so there are no separate `CLOUDFLARE_*` repo secrets to manage.

Re-run the export whenever the TOML files change. (The `--repo`-less form writes local base64 files instead, **unencrypted**; prefer the `--repo` path.)

## Adapting the pipeline

- **Add an `Integration` environment** to your `wrangler.toml` (`[env.Integration]` with a distinct worker name) and `env.toml` (`[Integration]`). The workflow targets it, and each worker needs its resources (test database etc.) to exist there.
- Deploys inside CI re-run the workspace checks by default; append `--skip-workspace-checks` to the workflow's deploy line if `ci.yml` already gates the same commit and you want faster deploys.
- The production workflow's trigger-on-success wiring means a red integration run blocks production automatically; resist the temptation to decouple them.
