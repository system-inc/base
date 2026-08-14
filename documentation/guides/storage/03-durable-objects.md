---
title: Durable Objects
description: 'A Base worker with its own SQLite database, addressable by name: building one, calling it from another worker, and waking it on a schedule.'
---

A Durable Object is a single-instance worker with its own strongly-consistent storage. In Base, a DO is just a Base worker whose database is the object's embedded SQLite, with the same entities, the same repositories, and the same migrations discipline. The DO-ness lives almost entirely in configuration.

This guide builds a counter with persistent per-key state, then calls it by name from another worker.

## Scaffold the worker

```bash
npx base worker create counter --port 3001
```

Delete the scaffolded example services; this worker's identity lives in its entry point.

## The entry point

Replace `workers/counter/index.ts`:

```ts
import '@system-inc/base-foundation/startup/preload';

import { CfDurableObject } from '@system-inc/base-foundation/cloudflare/durable-object/core/CfDurableObject';
import { CfDurableObjectWorker } from '@system-inc/base-foundation/cloudflare/durable-object/core/CfDurableObjectWorker';
import { CounterSettings } from './settings';

export class CounterDurableObject extends CfDurableObject {
    settings = CounterSettings;
}

export default new CfDurableObjectWorker(CounterDurableObject);
```

Two exports, two jobs: the **named class** is what Cloudflare instantiates and wrangler binds by name; the **default export** forwards requests to the object during local development. Everything Base (settings, services, the ORM) runs _inside_ the object.

## Define an entity

In `workers/counter/source/entities/CounterEntity.ts`, nothing is Durable-Object-specific:

```ts
import { OrmColumn } from '@system-inc/base-foundation/orm/decorators/OrmColumn';
import { OrmCreateDateColumn } from '@system-inc/base-foundation/orm/decorators/OrmCreateDateColumn';
import { OrmPrimaryAutoColumn } from '@system-inc/base-foundation/orm/decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '@system-inc/base-foundation/orm/decorators/OrmTable';
import { OrmUpdateDateColumn } from '@system-inc/base-foundation/orm/decorators/OrmUpdateDateColumn';
import { OrmTrackingEntity } from '@system-inc/base-foundation/orm/entity/OrmTrackingEntity';

@OrmTable('counter')
export class CounterEntity extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 255 })
    declare key: string;

    @OrmColumn({ kind: 'integer', size: 'int32' })
    declare value: number;

    @OrmCreateDateColumn()
    declare createdAt: Date;

    @OrmUpdateDateColumn({ nullable: true })
    declare updatedAt: Date | null;
}
```

## Configure the durable database

The one structural difference from a normal worker: there's no external database to reach, so **migrations ship inside the bundle**. In `workers/counter/settings.ts`:

```ts
import { BaseSettings } from '@system-inc/base-foundation/base/BaseSettings';
import { DurableProvider } from '@system-inc/base-foundation/orm/database/adapter/drizzle/sqlite/DurableProvider';
import migrations from './database/@default/drizzle/migrations/migrations';
import release from './database/@default/drizzle/release';
import { CounterEntity } from './source/entities/CounterEntity';
import { CounterHttpService } from './source/services/CounterHttpService';

export const CounterSettings: BaseSettings = {
    name: 'counter',
    version: '1.0.0',
    title: 'Counter',
    server: {
        '@default': { port: 3001 },
    },
    modules: [],
    orm: {
        '@default': {
            adapterType: 'drizzle',
            databaseType: { dialect: 'sqlite', driver: 'durable' },
            adapter: DurableProvider,
            entities: [CounterEntity],
            migrations,
            released: release.released,
        },
    },
    services: [CounterHttpService],
};
```

Generate the migration files the two imports point at:

```bash
npx base orm schema:generate -w counter
```

This diffs the entity, writes the SQL migration under `workers/counter/database/@default/drizzle/`, and maintains the `migrations` barrel plus the `release` file. The barrel imports the generated `.sql` files directly, and pending migrations apply when the object wakes. (If the settings file won't compile before the first generate because the imports don't exist yet, comment the two lines out for the first run, then restore them.)

## wrangler.toml: The Durable Object trio

```toml
main = "index.ts"
compatibility_date = "2024-05-12"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["CounterDurableObject"]

[[rules]]
type = "Text"
globs = ["**/*.sql"]
fallthrough = true

[env.Development]
name = "counter"
durable_objects = { bindings = [
    { name = "CounterDurableObject", class_name = "CounterDurableObject" },
]}
```

Each piece is load-bearing:

- **`new_sqlite_classes`** (not `new_classes`): required for the SQLite-backed storage the ORM rides.
- **The `[[rules]]` block** lets the migrations barrel import `.sql` files as text; omit it and the bundle fails.
- **The `durable_objects` binding** names your class.

Run `npx base check counter` to confirm it all lines up.

## Write the service

In `workers/counter/source/services/CounterHttpService.ts` this is ordinary ORM code; the DO-ness is already behind you:

```ts
import { Injectable } from '@system-inc/base-foundation/dependency-injection/decorators/Injectable';
import { OrmRepository } from '@system-inc/base-foundation/orm/database/repository/OrmRepository';
import { InjectRepository } from '@system-inc/base-foundation/orm/decorators/InjectRepository';
import { equals } from '@system-inc/base-foundation/orm/filters/OrmEqualsFilter';
import { HttpPath } from '@system-inc/base-foundation/router/decorators/HttpPath';
import { HttpRoute } from '@system-inc/base-foundation/router/decorators/HttpRoute';
import { HttpService } from '@system-inc/base-foundation/router/decorators/HttpService';
import { CounterEntity } from '../entities/CounterEntity';

@Injectable()
@HttpService()
export class CounterHttpService {
    constructor(
        @InjectRepository(CounterEntity)
        private readonly counters: OrmRepository<CounterEntity>,
    ) {}

    @HttpRoute('GET', '/counter/:key')
    async get(
        @HttpPath('key') key: string,
    ): Promise<{ key: string; value: number }> {
        const counter = await this.counters.findOne({
            where: { key: equals(key) },
        });
        return { key, value: counter?.value ?? 0 };
    }

    @HttpRoute('POST', '/counter/:key/increment')
    async increment(
        @HttpPath('key') key: string,
    ): Promise<{ key: string; value: number }> {
        const existing = await this.counters.findOne({
            where: { key: equals(key) },
        });
        if (existing) {
            existing.value += 1;
            await this.counters.update(existing);
            return { key, value: existing.value };
        }
        const created = CounterEntity.from({ key, value: 1 });
        await this.counters.insert(created);
        return { key, value: created.value };
    }
}
```

Entities, `@InjectRepository`/`@InjectDatabase`, `findOne`/`insert`/`update` are all [ordinary ORM code](../orm/04-query-data.md).

## Run it

```bash
npx base develop counter
```

```bash
curl -X POST http://localhost:3001/counter/page-views/increment
curl -X POST http://localhost:3001/counter/page-views/increment
curl http://localhost:3001/counter/page-views     # {"key":"page-views","value":2}
```

Restart the dev server and read again: still `2`. That's the object's SQLite on disk, migrated and typed end to end.

Notice what a Durable Object buys over D1 here: every request to this object executes **serially against its own state**, so the read-increment-write in `increment` can't race with itself. Counters, rate limiters, game rooms, collaborative sessions: anywhere "one authoritative copy of this state" is the requirement, this is the shape.

## Calling a Durable Object from another worker

The caller declares the namespace in its settings and binds it cross-script in wrangler:

```ts
    durableObjects: [{ namespace: 'CounterDurableObject' }],
```

```toml
durable_objects = { bindings = [
    { name = "CounterDurableObject", class_name = "CounterDurableObject", script_name = "counter" },
]}
```

Then a provider hands out **handles by name**, one object instance per name, created on first use:

```ts
import { CfDurableObjectProvider } from '@system-inc/base-foundation/cloudflare/durable-object/CfDurableObjectProvider';

const provider = CfDurableObjectProvider.create<CounterRpcInterface>(
    'CounterDurableObject',
    configuration,
);

const handle = provider.getDurableObject({ name: `counter:${userId}` });
await handle.rpc.call().increment();
```

The handle carries the raw `stub` and a typed **`rpc`** client: [RPC](../rpc/01-use-rpc.md) over the DO binding, so the DO's service interface is shared and typed exactly like any worker-to-worker call. Omit the input for a unique anonymous instance.

The per-name instance model is the design tool: one object per user, per room, per rate-limit key, each with serialized execution and its own consistent database. (Base's own WebSocket layer uses one DO per socket the same way.)

## Alarms

DOs support alarms: scheduled wake-ups delivered through the same [`@ScheduledExecutable`](../scheduled/01-scheduled-tasks.md) interface, with `context.type === 'alarm'` carrying `isRetry` and `retryCount`. Failed alarm runs are retried by the platform automatically.

## Deploying

Ship it with `migration:release` + `deploy` like any other worker; see [Deploying](../deployment/03-deploying.md).
