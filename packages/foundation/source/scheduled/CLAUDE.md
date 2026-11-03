# scheduled/ — scheduled executables

Run work on a schedule — from a Cloudflare Cron trigger or a Durable Object `alarm()`. You write an `Executable` and decorate it; `Base.handleScheduled` runs the matching ones on the `@scheduled` container via `internal/scheduled/ScheduledRunner`.

## Defining a scheduled executable

```ts
@ScheduledExecutable('0 * * * *')   // hourly
export class HourlyRollup implements ScheduledExecutableInterface {
  async execute(context: ScheduledExecutableContext) { ... }
}
```

`ScheduledExecutableInterface` (`ScheduledExecutableInterface.ts`) is `Executable<[ScheduledExecutableContext]>` (the `execute(context)` shape from [`base-common/executable`](../../../common/CLAUDE.md)); the decorator itself lives in `decorators/ScheduledExecutable.ts`. List the class in a module's (or the worker's) `services` — its `@ScheduledExecutable` decorator sorts it into the scheduled set.

### `@ScheduledExecutable(cron?)` — the cron argument matters

- **With a cron** — validated (`cronExpressionIsValid`) and registered in `BaseMetadata.scheduled` to auto-run when a trigger matches that expression.
- **Without a cron** — the class is only decorator-_marked_; it is **not** auto-run. Use this when a module wires the cron from config later.
- **`CRON_ANY_TRIGGER`** — pass explicitly to run on every trigger the worker receives.

## Running (`internal/scheduled/ScheduledRunner`)

`Base.handleScheduled(event)` creates a `@scheduled` child container and calls `ScheduledRunner.runScheduled(context, cron)`. The runner selects the executables whose registered cron matches and runs them under a `CountingSemaphore` whose size is `ScheduledSettings.concurrency` clamped to **1–10** (default 1 = sequential).

## On Node (`internal/scheduled/CronScheduler`)

Cloudflare's cron service delivers triggers declared in `wrangler.toml` (which Base never reads). Node has none, so `BaseWorkerNodeRunner` fires them with a `CronScheduler`, calling `worker.scheduled(event, …)` — the same `Base.handleScheduled` path, on a `@scheduled` container — with a synthesized event (`cron`, the _planned_ `scheduledTime`, a no-op `noRetry()`). Triggers default to every cron a registered executable is registered against (`ScheduledMetadata.getTriggersFor`; `CRON_ANY_TRIGGER` isn't a schedule), or `ScheduledSettings.triggers` replaces them — validated at `start()`, so a bad one fails it. `server[runConfig].scheduled: false` turns firing off for that run config (Cloudflare runs a cron once; every Node instance runs its own). The scheduler computes each next fire from now (UTC, `dateFromCronExpression`), never by interval, so after a stall a trigger fires once without catching up; chains timers past `setTimeout`'s 2³¹−1 ms limit; skips a fire while that trigger's previous run is in flight; logs failures without stopping. `runner.stop()` (called by the shutdown-signal handler) cancels the timers and waits for in-flight runs and requests up to `requestTimeout`. Under `base develop --test-scheduled` in local mode the runner serves `GET /__scheduled?cron=<expr>`, as `wrangler dev --test-scheduled` does.

## `ScheduledExecutableContext`

A union over the two trigger sources, both carrying the DI `container`:

| `type`        | Source                   | Fields                               |
| ------------- | ------------------------ | ------------------------------------ |
| `'scheduled'` | Cloudflare Cron          | `scheduledTime`, `cron`, `noRetry()` |
| `'alarm'`     | Durable Object `alarm()` | `isRetry`, `retryCount`              |

Use the `isScheduledExecutableContextScheduledEvent` guard to discriminate.

## Settings (`ScheduledSettings`)

`concurrency` (default 1, clamped 1–10); `triggers` (Node only, see above). Executable classes are contributed through `services`.

## Persisted / DB-backed

`OrmPersistedScheduledExecutable` + `OrmScheduledExecutableEntity` support database-backed scheduled work: each run inserts a `Processing` row and marks it `Completed` or `Failed`. `run` returning `false` is a recorded soft failure; a thrown error is recorded as `Failed` and **rethrown**, so it reaches the platform like any executable's (a failed status write is logged, never allowed to replace the original error).

## See also

[`queue/`](../queue/CLAUDE.md) · [`cloudflare/`](../cloudflare/CLAUDE.md) (Durable Object alarms) · [`base/`](../base/CLAUDE.md) (`handleScheduled`).
