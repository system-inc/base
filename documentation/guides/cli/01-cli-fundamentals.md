---
title: CLI Fundamentals
description: How base finds your workspace, your worker, and your environment, and how to see what it resolved.
---

Every `base` command answers three questions before it does anything: _which workspace am I in, which worker am I operating on, and which environment am I targeting?_ Understanding those three resolutions is most of understanding the CLI.

## Invoking

```bash
npx base <command>            # the workspace-local CLI from node_modules
npm run base -- <command>     # equivalent, via the scaffolded script
```

Three global options work on every command:

- **`[worker]`**: most commands take the worker as a positional (`base develop app`); `-w app` is the equivalent flag form.
- **`-e, --environment`**: the target environment. Defaults to `Development`.
- **`--workers-folder`**: override where workers live.

## Worker resolution

When you don't name a worker, the CLI infers it from where you are:

1. An explicit positional or `-w` always wins.
2. If your **current directory is a worker** (it contains `settings.ts`), that's the worker, so `cd workers/app && npx base develop` just works.
3. Otherwise you'll be asked: `No worker specified. Pass -w <name> or run from inside a worker folder.`

A worker _is_ "a directory containing `settings.ts`" — that's also how `--all-workers` discovers the workspace's workers.

## Workspace resolution

The workers folder resolves in precedence order:

1. `--workers-folder <path>`: explicit override.
2. Your current directory _is_ a worker → its parent is the workers folder.
3. The nearest `package.json` (walking up) with a `"base": { "workersFolder": "..." }` block — the scaffold sets `"./workers"`.
4. A `./workers/` directory under the current directory.
5. The current directory itself.

The same `package.json` `base` block can set `"persistTo"` — the directory for wrangler's local state (D1/KV/R2/DO data). The scaffold sets `"./.wrangler/state"` at the workspace root so **all workers share one local state root**; `base develop`, `orm migration:run --local`, and `orm db:reset` all honor it (and a `--persist-to` flag overrides it per run — keep them consistent, or your migrations land in a different local database than your dev server reads).

## Environments

`-e` selects a **named environment**: a `[env.<Name>]` section in `wrangler.toml`, a `[<Name>]` section in `env.toml`, and a key in environment-keyed settings like `server`. Two names carry built-in behavior:

- **`Development`** (the default): skips the released-migrations deploy gate; local dev mode.
- **`Production`**: refuses to deploy a dirty git tree.

Anything else (`Staging`, `Integration`, …) is yours to define — the CLI treats custom names as first-class environments with no special gates beyond the standard checks.

## When resolution surprises you

```bash
npx base info
npx base info app --with-settings
```

`info` prints the resolved workspace, worker, environment, and the exact resolution path that produced them — plus, with `--with-settings`, the worker's modules and databases. It's read-only and the first thing to reach for when a command seems to be operating on the wrong thing.

Next: [the development loop](./02-develop-and-build.md), or the [full command reference](./03-command-reference.md).
