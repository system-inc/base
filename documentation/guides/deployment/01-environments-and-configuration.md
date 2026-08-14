---
title: Environments and Configuration
description: One settings file across many environments, and how configuration and secrets layer.
identifier: environments
---

A Base worker describes every environment it runs in from one place. Three files cooperate, each with per-environment sections, and the CLI assembles the active environment's view at run time.

## The three layers

**`settings.ts`** holds environment-keyed _behavior_. Settings like `server` are maps with `'@default'` as the fallback and environment names as overrides:

```ts
    server: {
        '@default': { port: 3000 },
        Integration: { host: 'https://app-test.example.workers.dev' },
    },
```

Each named block is complete on its own; there's no field-level inheritance from `'@default'`, so a block that sets only `host` doesn't inherit someone else's `port`.

**`wrangler.toml`** declares per-environment _platform resources_, under `[env.<Name>]`: the worker's deployed name, D1 databases, KV namespaces, queues, service bindings.

**`env.toml`** supplies per-environment _variables and secrets_, gitignored by design:

```toml
[Development]
DATABASES = [{ name = "@default", url = "mysql://..." }]

[Production]
CLOUDFLARE_ACCOUNT_ID = "..."
CLOUDFLARE_API_TOKEN = "..."
STRIPE_API_KEY = "..."
```

A workspace-level `env.toml` (in the workers folder) layers underneath every worker's own, so shared values live once.

## How variables flow

For the active environment, the CLI merges (later wins): `wrangler.toml` `[env.X.vars]` → workspace `env.toml [X]` → worker `env.toml [X]`. Then it splits the result:

- **Worker variables** are passed to your worker as bindings: objects and arrays are JSON-stringified transparently (that's why `DATABASES = [{...}]` works).
- **CLI credentials** (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `WRANGLER_LOG`, and friends) are lifted out and given only to the tooling: the wrangler subprocess, and the CLI's own Cloudflare API calls for [remote D1 work](../orm/03-migrations.md). They never become worker bindings, so platform credentials can live in `env.toml` without leaking into your runtime.

## Environment names

`-e <Name>` selects the environment; `Development` is the default. Names are free-form: define `Staging`, `Integration`, `Dogfood`, whatever your pipeline needs. This is deliberate design, not an unfinished enum: exactly two names are **semantic poles** with framework behavior attached, and every custom name lands in a strict middle that treats it as a real environment by default.

|                                               | `Development`  | Custom (`Staging`, `Dogfood`, …) | `Production` |
| --------------------------------------------- | -------------- | -------------------------------- | ------------ |
| GraphiQL + introspection default              | on             | off                              | off          |
| Durable Object migration drift                | wipe + reapply | refuse                           | refuse       |
| Unreleased migrations (deploy gate + runtime) | allowed        | refused                          | refused      |
| Dirty git tree on deploy                      | warn           | warn                             | refuse       |

The dev loop's conveniences are opt-in by the exact name `Development`; `Production`'s maximal ceremony is opt-in by the exact name `Production`. Everything in between needs no registration and gets protective defaults. The framework will not grow this list, because an `isStaging` predicate would have no framework behavior to attach to; code that branches on a custom environment compares `environment.type === 'Staging'` (or wraps its own helper).

Two spelling rules: `Development` and `Production` are recognized case-insensitively and normalized; **custom names are verbatim and case-sensitive**, so `staging` and `Staging` are different environments. In practice the `wrangler.toml` `[env.<Name>]` lookup is exact-match, so a misspelled or case-drifted `-e` value fails loudly on missing configuration rather than silently selecting dev behavior.

When you add an environment, add its section to all three files (settings if behavior differs, `wrangler.toml` `[env.<Name>]`, `env.toml [<Name>]`).

## Scoping workers to environments

A worker can declare where it's allowed to deploy:

```ts
    deployEnvironment: ['Integration', 'Production'],
```

`check` and `deploy` (including `--all-workers`) skip the worker everywhere else, even with `--force`. Undefined means "deploy anywhere"; an **empty array means nowhere**, the pattern for example or fixture workers that should never ship.
