---
title: Logging
description: Use the level-gated Logger, set thresholds per environment, and control the request log.
---

Base ships a level-gated logger. Below the configured threshold a log call is a single integer compare (no string is built, nothing reaches `console`) which matters on the request hot path, where unconditional `console.log` calls measurably cut throughput. The output still goes to `console.*` underneath: on Cloudflare that is what `base tail`, the dashboard, and observability read; nothing about how you collect logs changes.

Rule of thumb: use the `Logger` in **worker execution-path code**, meaning anything that runs while your worker boots or serves traffic. Output aimed at a human running a tool (a script's progress, a fatal config error before `process.exit`) belongs on plain `console`, where no level setting can hide it.

## Log from your code

Every log line belongs to a **category**: a short name like `notes` or `billing` that prefixes the output (`[notes] …`) and can carry its own threshold. No injection, no setup; the static methods work anywhere, including code that runs before the container exists:

```ts
import { Logger } from '@system-inc/base-common/logging/Logger';

Logger.info('notes', 'worker started');
Logger.warn('notes', 'rate limit approaching for %s', accountId);
```

For a subsystem or module, bake the category in once at module top level with `Logger.create`. Same categories, same settings, just no per-call lookup (prefer it on hot paths):

```ts
const logger = Logger.create('notes');

logger.debug('cache miss for %s', noteId);
logger.error('failed to sync note %s', noteId, error);
```

Two habits keep gated calls free:

- **Format printf-style** (`%s`, `%d`, `%o` for objects) instead of template literals. A template literal builds the string whether or not debug is on; the printf form passes references and lets `console` assemble the string only when the line is actually emitted.
- **Guard expensive computation** with `isDebugEnabled` / `isEnabled(level)` when producing the message itself costs something:

```ts
if (logger.isDebugEnabled) {
    logger.debug(stopWatch.toString());
}
```

## Set the threshold

Levels are `debug < info < warn < error < off`; the default threshold is `info`. Set in-code defaults in your worker's settings: a global `level`, and optionally per-category thresholds that override it. Turn one subsystem up without drowning in the rest:

```ts
import { LogLevel } from '@system-inc/base-common/logging/LogLevel';

const settings: BaseSettings = {
    // ...
    logging: {
        level: LogLevel.Warn,
        categories: { rpc: LogLevel.Debug },
    },
};
```

At deploy time, the **`LOG_LEVEL`** environment variable (in `env.toml`, per environment) overrides settings, with no rebuild. It carries the same two shapes, comma-separated: a default level and/or `category=level` entries:

```toml
[production.variables]
LOG_LEVEL = "warn,rpc=debug"
```

The env directive wins over settings for whatever it mentions; settings it doesn't mention keep their in-code values.

A typo in `LOG_LEVEL` fails the worker's boot with the list of valid levels; it does not silently change what production logs.

The framework's own categories: `base` (boot, dispatch), `http`, `rpc`, `gql`, `orm`, `queue`, `scheduled`, `ws`, `event`, `kv`, `durable`.

## The request log

The per-request line the framework emits (`GET /notes 200 OK (12ms)`) has its own boolean switch, separate from the levels; it's a request log, not an application log, and it is the single most expensive log line on the hot path. It sits alongside `level` in the same `logging` block:

```ts
logging: {
    level: LogLevel.Warn,
    requestLog: false,
},
```

**Maximum-throughput posture** for a hot production worker: exactly the block above (or `LOG_LEVEL = "warn"` in `env.toml` instead of the in-code `level`). Cloudflare's own request logs still record every invocation; `warn`/`error` still reach `base tail`.

## Correlate requests

Include the [`context.requestId`](../request-context/01-use-the-request-context.md) in log lines inside request handlers and multi-request traces stay untangled. The logger deliberately does not attach per-request state itself, so hot-path calls stay allocation-free.
