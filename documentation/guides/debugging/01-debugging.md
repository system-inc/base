---
title: Debugging
description: Attach a debugger locally, turn up wrangler's logs, and tail deployed workers.
---

## Breakpoints against the dev server

`base develop` always exposes a V8 inspector. The port is deterministic:

- `settings.server['@default'].inspectorPort` if you set one;
- Otherwise **your dev port + 10000**: a worker on `3000` exposes its inspector on `13000`.

The scaffolded workspace ships a ready-made VS Code configuration, **"Wrangler: Attach"**: start `npx base develop app`, run the configuration, enter the inspector port when prompted, and breakpoints in your TypeScript bind through sourcemaps. (Any inspector client works: `chrome://inspect` pointed at `localhost:13000` gets you DevTools.)

## Debugging tests

Two more scaffolded configurations cover jest:

- **"Test: Current File"**: launches the test file you're editing under the debugger.
- **"Test: All"**: the whole unit suite, in-band.

Both use `--inspect-brk`, so execution pauses at entry and your breakpoints are guaranteed to arm before code runs. Integration tests are ordinary jest too — the same configurations work; keep the worker running in another shell.

## Debugging on the Node platform

**"Run: Current Worker (Node)"** launches the worker itself as a debuggable Node process — open the worker's `index.ts` and start the configuration. Because it runs under VS Code's debugger from the start, no attach step is needed. This is often the fastest way to step through boot-time behavior (settings loading, module initialization) that's awkward to catch by attaching.

## Turning up the logs

- **`LOG_LEVEL`** — set `"debug"` (or `"info,rpc=debug"` for one subsystem) in `env.toml` to open up the framework's [level-gated logging](../logging/01-logging.md): request timing breakdowns, RPC dispatch tracing, and anything your own code logs at debug.
- **`WRANGLER_LOG`**: set `"debug"` in `env.toml` under the environment you're running to see wrangler's full internals; it's one of the CLI-level variables, so it never leaks into worker bindings.
- **`base info app --with-settings`** — when the mystery is "what did it even load?": prints the resolved workspace, worker, environment, resolution path, modules, and databases.
- **`Logger` + `requestId`**: every request carries a [`context.requestId`](../request-context/01-use-the-request-context.md); include it in log lines and multi-request traces stay untangled.

## Production: tail, don't guess

```bash
npx base tail app -e Production --format pretty
npx base tail app -e Production --status error
npx base tail app -e Production --search "VALIDATION_ERROR" --ip self
```

`tail` streams live invocation logs from the deployed worker — status, method, header, text-search, and sampling filters keep it readable under load. The `-e` is load-bearing: the environment defaults to `Development`, so leaving it off tails your dev worker instead of production. Pair it with the [deploy metadata](../deployment/03-deploying.md#what-gets-stamped-into-a-release) (`COMMIT_SHA`, `DEPLOYED_BY`) and "what is production actually running?" stops being a question.
