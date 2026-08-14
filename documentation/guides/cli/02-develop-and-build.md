---
title: Develop and Build
description: The daily loop (develop, check, bundle, tail) plus scaffolding new workers.
---

## `base develop`: The dev server

```bash
npx base develop app
```

Loads `settings.ts`, resolves the server configuration, and runs your worker locally — on Cloudflare's workerd runtime via `wrangler dev` by default, or as a Node process with `--platform node` (same app model, the platform delegate does the adapting).

**Ports come from settings, not flags.** The dev server listens on `settings.server['@default'].port`; the debugger's inspector port is `settings.server['@default'].inspectorPort`, defaulting to **port + 10000** (a worker on 3000 exposes its inspector on 13000). There is no `--port` flag — the settings file is the single source of truth the CLI and runtime share.

Options you'll actually use:

- **`--run-config <name>`** (`-c`): use a different named `server` configuration than `'@default'`.
- **`--remote`**: develop against real resources on Cloudflare's network instead of local simulations.
- **`--test-scheduled`**: enables triggering cron handlers by hand; prints the `http://localhost:<port>/__scheduled?cron=...` URL to hit.
- **`--persist-to <dir>`**: override where local D1/KV/R2/DO state lives (defaults to the workspace's `base.persistTo`).

HTTPS and a custom host come from settings too: `server: { '@default': { protocol: 'https', keyPath, certificatePath, host } }`.

## `base check`: Validate before you run

```bash
npx base check app
npx base check --all-workers
```

The pre-flight validator. It loads your settings, boots the framework's configuration, and cross-checks everything that can drift:

- **`wrangler.toml` bindings** against settings: queues (producers and consumers), KV namespaces, R2 buckets, D1 databases, Durable Objects, containers, and RPC service bindings all must exist for what your settings declare.
- **Module config validators**: every registered module's `cli.configValidators` run with your environment and bindings.
- **ORM schema freshness**: `schema.generated.ts` must match your entities (it tells you the exact `schema:generate` command if not).
- **GraphQL schema drift**: the committed SDL baseline must be compatible.

Run it in CI and before deploys (deploys run it automatically). A worker whose `deployEnvironment` excludes the target environment is skipped, not failed.

## `base bundle`: Build and inspect the bundle

```bash
npx base bundle app
npx base bundle app --analyze            # per-package bundle-size breakdown
npx base bundle app --analyze --expand   # per-file rows
```

Produces `workers/app/build/index.js` (+ sourcemap). By default it builds through wrangler's own pipeline (the _same_ bundle a deploy would produce) so `--analyze` numbers are honest. `--minify`, `--tree-shake`, and `--watch` switch to a direct esbuild build for faster iteration.

## `base tail`: Live production logs

```bash
npx base tail app -e Production
npx base tail app -e Production --status error --search "timeout"
```

Streams the deployed worker's logs, with filters for status, method, header, IP (`--ip self`), text search, sampling rate, and worker version. Pass `-e` explicitly — the environment defaults to `Development`, so an unqualified `base tail app` tails your dev worker, not the deployed one. One caveat: it tails by the worker's directory name — if your `wrangler.toml` gives environments different `name`s, tail the right one from wrangler directly.

## Scaffolding

```bash
npx @system-inc/base-cli workspace create my-app   # a new workspace + starter worker
npx base worker create billing                      # another worker in this workspace
```

`workspace create` takes `--name`, `--starter` (the first worker's name, default `app`), `--port` (default 3000), `--no-install`, and `--force`. `worker create` takes `--port` and `--force`, and prints the two commands to run next. Every worker is born with `settings.ts`, `index.ts`, `wrangler.toml`, `env.toml`, an example service pair, and an integration test.
