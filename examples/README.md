# base examples

Example workers that exercise the [Base](../README.md) packages end to end. Each subfolder is a self-contained Cloudflare Worker (its own `settings.ts`, `wrangler.toml`, `index.ts`) and doubles as an integration-test fixture for the framework. This workspace is **private** — it is not published.

| Worker                | Demonstrates                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------ |
| `test-worker`         | A full worker: HTTP routing, GraphQL, database/ORM, and cross-dispatcher integration tests |
| `base-durable`        | A Cloudflare Durable Object built on Base                                                  |
| `test-queue-producer` | Producing messages to a worker queue                                                       |
| `test-queue-consumer` | Consuming/processing queued messages                                                       |

The repo root `package.json` sets `base.workersFolder` to `./examples`, so the `base` CLI finds these workers by name.

## Running

Build first (the CLI runs the compiled `dist/`, so keep `npm run dev` going in another terminal for live edits — see the [cli README](../packages/cli/README.md)):

```bash
npm run build                              # from the repo root

# run one worker locally (wrangler dev)
npm run base -- develop -w test-worker
# equivalently, from anywhere:
npx base develop -w test-worker --workersFolder examples
```

## Testing

```bash
npm run base -- test -w test-worker        # one worker's integration tests
npm run test:integration                   # all workers (base test --all-workers)
```

Environment is layered from `env.toml` (per worker) and the workspace-level `env.toml` / `workspace.*.env.toml.base64` here.

---

Part of the [Base](../README.md) monorepo.
