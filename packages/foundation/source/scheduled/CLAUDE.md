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

## `ScheduledExecutableContext`

A union over the two trigger sources, both carrying the DI `container`:

| `type`        | Source                   | Fields                               |
| ------------- | ------------------------ | ------------------------------------ |
| `'scheduled'` | Cloudflare Cron          | `scheduledTime`, `cron`, `noRetry()` |
| `'alarm'`     | Durable Object `alarm()` | `isRetry`, `retryCount`              |

Use the `isScheduledExecutableContextScheduledEvent` guard to discriminate.

## Settings (`ScheduledSettings`)

`concurrency` (default 1, clamped 1–10). Executable classes are contributed through `services`.

## Persisted / DB-backed

`OrmPersistedScheduledExecutable` + `OrmScheduledExecutableEntity` support database-backed scheduled work.

## See also

[`queue/`](../queue/CLAUDE.md) · [`cloudflare/`](../cloudflare/CLAUDE.md) (Durable Object alarms) · [`base/`](../base/CLAUDE.md) (`handleScheduled`).
