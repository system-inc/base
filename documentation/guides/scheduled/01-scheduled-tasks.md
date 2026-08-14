---
title: Scheduled Tasks
description: Run code on a cron schedule with @ScheduledExecutable.
---

A scheduled task is a class with an `execute` method, decorated with its cron expression.

## Define and register

```ts
import { CRON_EVERY_HOUR } from '@system-inc/base-common/cron/CronExpression';
import { ScheduledExecutable } from '@system-inc/base-foundation/scheduled/decorators/ScheduledExecutable';
import { ScheduledExecutableContext } from '@system-inc/base-foundation/scheduled/ScheduledExecutableContext';
import { ScheduledExecutableInterface } from '@system-inc/base-foundation/scheduled/ScheduledExecutableInterface';

@Injectable()
@ScheduledExecutable(CRON_EVERY_HOUR)
export class CleanupExecutable implements ScheduledExecutableInterface {
    constructor(
        @InjectRepository(SessionEntity)
        private readonly sessions: OrmRepository<SessionEntity>,
    ) {}

    async execute(context: ScheduledExecutableContext): Promise<void> {
        // delete expired sessions...
    }
}
```

```ts
    services: [CleanupExecutable],
```

Both halves matter: the decorator declares _when_, the `services` entry declares _that it exists here_ — an executable missing from `services` never runs. The cron expression is validated at class-definition time, so a typo fails immediately, not silently.

`@system-inc/base-common/cron/CronExpression` exports a large set of readable constants: `CRON_EVERY_MINUTE`, `CRON_EVERY_HOUR`, `CRON_EVERY_DAY_AT_MIDNIGHT`, `CRON_WEEKDAYS_AT_9AM`, `CRON_LAST_DAY_OF_MONTH`, … — or pass any valid cron string. `CRON_ANY_TRIGGER` runs on every trigger the worker receives, whatever its schedule.

## Tell Cloudflare to trigger the worker

The decorator registers the executable _inside_ Base; **Cloudflare only delivers scheduled events if `wrangler.toml` declares triggers**, and this is one pairing `base check` does not validate, so it's on you:

```toml
[triggers]
crons = ["0 * * * *"]
```

Incoming triggers are matched against each executable's expression: an hourly trigger runs the `CRON_EVERY_HOUR` tasks (plus any `CRON_ANY_TRIGGER` ones).

## Config-driven schedules

When the cron comes from configuration rather than code, use the bare decorator and register the schedule programmatically — typically in a [module's `onCreate`](../modules/01-create-a-module.md#lifecycle):

```ts
@ScheduledExecutable()   // marked, but no schedule of its own
export class ReportExecutable implements ScheduledExecutableInterface { ... }
```

```ts
        onCreate: () => {
            if (settings?.reportCron) {
                getBaseMetadata().scheduled.addScheduledExecutable(
                    ReportExecutable,
                    settings.reportCron,
                );
            }
        },
```

## Concurrency and failures

Multiple executables matching one trigger run with concurrency 1 by default; raise it (max 10) via settings:

```ts
    scheduled: { concurrency: 3 },
```

All matching executables run to completion; failures are collected and rethrown at the end, so the platform sees the run as failed (and, for Durable Object alarms, retries it).

## Test locally

```bash
npx base develop app --test-scheduled
curl "http://localhost:3000/__scheduled?cron=*+*+*+*+*"
```

The `cron` query parameter is the URL-encoded trigger expression — send the schedule you want to simulate, and the matching executables fire.

One more context: inside a [Durable Object](../storage/03-durable-objects.md), alarms dispatch through the same interface: `context.type` tells you whether you're running from a `'scheduled'` cron or an `'alarm'`, with retry metadata on the alarm branch.
