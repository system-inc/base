---
title: Multiple Databases
description: Name several databases in one worker, and route repositories to the right one.
---

A worker can attach any number of databases — different engines included. Each gets a name in the `orm` settings map, and injection routes by that name.

## Name the databases

```ts
import { PlanetScaleProvider } from '@system-inc/base-foundation/orm/database/adapter/drizzle/mysql/PlanetScaleProvider';
import { D1Provider } from '@system-inc/base-foundation/orm/database/adapter/drizzle/sqlite/D1Provider';

    orm: {
        '@default': {
            adapterType: 'drizzle',
            databaseType: { dialect: 'mysql', driver: 'planetscale' },
            adapter: PlanetScaleProvider,
            entities: [UserEntity, PostEntity],
        },
        analytics: {
            adapterType: 'drizzle',
            databaseType: { dialect: 'sqlite', driver: 'd1' },
            adapter: D1Provider,
            binding: 'ANALYTICS_DATABASE',
            entities: [PageViewEntity],
        },
    },
```

Supported engine pairs: SQLite with `d1`, `durable`, or `better-sqlite`; MySQL with `planetscale`. Each named database keeps its own entity list and its own [migration history](./03-migrations.md).

## Route an injection to a named database

Injections resolve to `'@default'` unless told otherwise. A `DatabaseBinding` names the target:

```ts
import { DatabaseBinding } from '@system-inc/base-foundation/orm/DatabaseBinding';

const ANALYTICS = new DatabaseBinding('analytics');

@Injectable()
export class AnalyticsService {
    constructor(
        @InjectRepository(PageViewEntity, ANALYTICS)
        private readonly pageViews: OrmRepository<PageViewEntity>,
    ) {}
}
```

The binding string matches the `orm` settings key exactly.

## Inject a whole database

When a service works across several entities of one database (or needs database-level operations) inject the `OrmDatabase` instead of individual repositories:

```ts
import { OrmDatabase } from '@system-inc/base-foundation/orm/database/OrmDatabase';
import { InjectDatabase } from '@system-inc/base-foundation/orm/decorators/InjectDatabase';

    constructor(
        @InjectDatabase()
        private readonly database: OrmDatabase,          // '@default'
        @InjectDatabase(ANALYTICS)
        private readonly analyticsDatabase: OrmDatabase, // named
    ) {}
```

`database.getRepository(Entity)` returns the same repositories `@InjectRepository` would.

## Module-aware routing

Inside a module, classes usually shouldn't hard-code which database they use — the worker composing the module decides. Token-less injections (`@InjectRepository(Entity)` with no binding) resolve **module-aware**: a class declared with `@Injectable(SomeModuleKey)` binds to the database its module resolves to, and an undeclared class gets `'@default'`. An explicit `DatabaseBinding` always wins. See the modules guide for the full picture.
