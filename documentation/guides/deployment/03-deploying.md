---
title: Deploying
description: The deploy gates, whole-workspace deploys, and what gets stamped into every release.
---

```bash
npx base deploy app --environment Production
```

The environment flag is required on deploys — there is no accidental default target. Before anything ships, a sequence of gates runs; each exists to make a class of bad deploy impossible.

## The gates, in order

1. **Clean git tree** (Production only): uncommitted changes refuse to deploy, so what ships is exactly what's in history. Other environments warn and mark the build dirty; `--allow-dirty` downgrades Production's refusal when you truly mean it.
2. **`base check`**: the full settings ↔ wrangler ↔ ORM ↔ GraphQL validation ([details](../cli/02-develop-and-build.md#base-check--validate-before-you-run)). Skipped only by `--force`.
3. **Released migrations**: pending migrations must be [promoted with `migration:release`](../orm/03-migrations.md) before the worker that depends on them can ship. Schema changes are deliberate, released acts.
4. **Workspace checks**: `npm run typecheck`, `lint`, and `test` from the workspace root. `--skip-workspace-checks` if your CI already ran them.

Then the worker is bundled and published via wrangler.

## Credentials

Deploying authenticates the way wrangler does — Base adds no requirement of its own. Any of these works: a `CLOUDFLARE_API_TOKEN` in `env.toml` (the CI path), the legacy `CLOUDFLARE_API_KEY` + `CLOUDFLARE_EMAIL` pair, or an interactive `wrangler login` session.

`CLOUDFLARE_ACCOUNT_ID` is only needed when your token can see more than one account; wrangler resolves a single-account token on its own, and `account_id` in `wrangler.toml` satisfies it too. The remote D1 tooling is stricter: `orm migration:run`, `orm schema:*`, and `orm db:studio` reach the [Cloudflare API directly](../orm/03-migrations.md) and require both the account ID and the token.

## Whole-workspace deploys

```bash
npx base deploy --all-workers -e Production
npx base deploy --all-workers -e Production --dry-run   # what would deploy?
```

`--all-workers` discovers every worker, applies each one's [`deployEnvironment` scope](./01-environments-and-configuration.md#scoping-workers-to-environments), runs the workspace gates once, and deploys every worker in scope. There is deliberately no "unchanged, skip" optimization: a deploy ships more than script bytes (wrangler.toml bindings and routes, container images), so a bytes-vs-live comparison could silently strand a config-only change, and wrangler publishes are idempotent, so always deploying is safe. `--dry-run` prints the would-deploy list and exits.

Workers deploy in **dependency order**: a worker whose `wrangler.toml` declares a [service binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/) or a cross-worker Durable Object binding (`script_name`) deploys after its target, because Cloudflare rejects a binding whose target script doesn't exist yet. This is what makes the _first_ deploy of a fresh workspace work in one command. Two workers that bind _each other_ can't be ordered by anyone — if the first deploy of a cycle member fails, deploy the rest and rerun (`base deploy <worker> --force` also works); after that first bootstrap, redeploys of a cycle are fine in any order.

## What gets stamped into a release

Every deploy injects build metadata as worker variables (unless already set):

| Variable          | Value                                                            |
| ----------------- | ---------------------------------------------------------------- |
| `COMMIT_SHA`      | the deployed commit (suffixed `-dirty` if the tree wasn't clean) |
| `BUILD_TIMESTAMP` | when the bundle was built                                        |
| `DEPLOYED_BY`     | the deploying git user, or `gh-actions[<actor>]` in CI           |
| `ENVIRONMENT`     | the target environment                                           |

Expose these in a status endpoint and every running worker can tell you exactly what it is and where it came from.

## The first deploy of a worker

New workers need their platform resources to exist: create the real D1 database (and any KV/R2/queues) once, put the IDs in `wrangler.toml`'s environment block, apply migrations with `npx base orm migration:run -w app -e <Env>`, then deploy. From that point on, [CI can carry it](./04-continuous-deployment.md).
