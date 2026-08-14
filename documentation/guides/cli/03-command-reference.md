---
title: Command Reference
description: Every command, subcommand, and option in the base CLI surface.
---

Global options (all commands): `[worker]` positional / `-w` · `-e, --environment` (default `Development`) · `--workers-folder`. Run `base <command> --help` for the same information in the terminal.

## Core

| Command            | What it does                                                      |
| ------------------ | ----------------------------------------------------------------- |
| `develop [worker]` | Start the local dev server (wrangler dev, or Node with `-p node`) |
| `check [worker]`   | Validate settings ↔ wrangler bindings ↔ ORM ↔ GraphQL baseline    |
| `bundle [worker]`  | Compile and bundle; `--analyze` for size breakdowns               |
| `deploy [worker]`  | Publish to Cloudflare (requires `-e`)                             |
| `test [worker]`    | Run integration tests against a running worker                    |
| `tail [worker]`    | Stream a deployed worker's logs                                   |
| `info [worker]`    | Print resolved workspace/worker/environment + resolution path     |
| `keygen`           | Generate an AES-GCM encryption key (`--format json\|toml`)        |

**`develop`**: `--platform/-p` (default `cloudflare`) · `--run-config/-c` (default `@default`) · `--remote` · `--test-scheduled` · `--persist-to <dir>`. Ports come from `settings.server`, not flags.

**`check`**: `--all-workers`.

**`bundle`**: `--bundler` · `--minify` · `--tree-shake` · `--watch` · `--analyze` · `--expand` (with analyze) · `--meta` (with analyze).

**`deploy`**: `--all-workers` (deploys every worker that targets the environment, binding targets before their binders) · `--dry-run` (checks only, no publish) · `--force` (skips checks, but not the git gate) · `--allow-dirty` (Production only needs this) · `--skip-workspace-checks` (CI that already ran typecheck/lint/test).

**`test`**: `--all-workers` · `--test-host` · `--test-name-pattern/-t` · `--test-path-pattern` · `--test-timeout` (default 60000).

**`tail`**: `--format json|pretty` · `--status ok|error|canceled` · `--method` · `--header` · `--search` · `--ip` (use `self` for your own) · `--sampling-rate` · `--version-id`.

**`info`**: `--with-settings` (loads settings.ts; lists modules + databases).

## Scaffolding

| Command                        | What it does                   |
| ------------------------------ | ------------------------------ |
| `workspace create [directory]` | New workspace + starter worker |
| `worker create <worker>`       | New worker in this workspace   |

**`workspace create`**: `--name` · `--starter` (default `app`) · `--port` (default 3000) · `--no-install` · `--force`.
**`worker create`**: `--port` (default 3000) · `--force`.

## Secrets

| Command                    | What it does                                    |
| -------------------------- | ----------------------------------------------- |
| `workspace secrets export` | Bundle every `env.toml`/`test.env.toml` for CI  |
| `workspace secrets import` | Restore them (`--env <VAR>` or `--file <path>`) |

`export --repo <owner>/<repo>` encrypts with the repo's Actions public key and uploads GitHub secrets `ENV_TOML` + `TEST_ENV_TOML` (needs a `GITHUB_API_TOKEN` with repo scope). **Without `--repo` it writes plaintext base64 files**; treat them like the secrets they are.

## ORM: `base orm <command>`

Group option: `--database <name>` (default: the `'@default'` database).

| Subcommand                   | What it does                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema:generate`            | Regenerate `schema.generated.ts` + create a migration (`--name/-m`, `--custom` for an empty migration, `--no-fold` to keep every iteration) |
| `schema:check`               | Read-only: fails if `schema:generate` would change anything (`--all-workers`)                                                               |
| `schema:sync`                | Apply entity schema directly, skipping migrations; a dev shortcut (`--force`, `--strict`, `--all-tables`)                                   |
| `schema:introspect`          | Dump the live database's schema for reference (`--casing`, `--tables-filter`)                                                               |
| `schema:compat`              | Verify a target environment's schema matches Development (`-t <env>`, Durable DBs)                                                          |
| `migration:run`              | Apply pending migrations (`--local` for wrangler's local D1, `--persist-to`)                                                                |
| `migration:check`            | Migration-file consistency: collisions, corrupt journal                                                                                     |
| `migration:baseline`         | Print SQL to adopt an already-matching database into migration tracking                                                                     |
| `migration:release`          | Promote migrations to the released list; deploys are blocked until released                                                                 |
| `migration:drop`             | Delete a migration **file** (not a database rollback)                                                                                       |
| `migration:upgrade-metadata` | Upgrade snapshot files after a drizzle-kit upgrade                                                                                          |
| `db:reset`                   | Wipe **local** state (`--local` required; `--dry-run` to preview; `--force` outside Development)                                            |
| `db:studio`                  | Drizzle Studio browser GUI (`--port`, default 4983)                                                                                         |

Workers sharing a database keep independent migration histories; the tracking table is suffixed per worker.

## GraphQL: `base graphql <command>`

| Subcommand        | What it does                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `schema:generate` | Emit the SDL snapshot to `<worker>/graphql/schemas/` (`--all-workers`, `--path/-p`, `--split-schema/-s`, `--metadata/-m`)                 |
| `schema:check`    | Fail on breaking changes vs the committed baseline (`--all-workers`, `--allow-breaking`, `--strict` treats dangerous changes as breaking) |

## Containers: `base container <command>`

| Subcommand         | What it does                                                        |
| ------------------ | ------------------------------------------------------------------- |
| `container bundle` | Bundle `<worker>/container/index.ts` for the container image        |
| `container dist`   | Bundle the container script + Node bootstrap into `container/dist/` |

`develop`, `deploy`, and `bundle` run the container build automatically when a `container/` folder exists; these exist for building it in isolation.
