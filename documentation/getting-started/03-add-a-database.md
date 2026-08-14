---
title: Add a Database
description: Define an entity with decorators, generate migrations, and persist your notes in Cloudflare D1.
---

By the end of this tutorial your notes will survive a restart: you'll define a database entity with decorators, generate and apply a SQL migration, and rewrite `NoteService` to read and write Cloudflare D1 through Base's ORM.

You'll continue with the notes API from [Your First Worker](./02-your-first-worker.md).

## Define an entity

An entity is a class whose decorators describe a table. Create `workers/app/source/entities/NoteEntity.ts`:

```ts
import { OrmColumn } from '@system-inc/base-foundation/orm/decorators/OrmColumn';
import { OrmCreateDateColumn } from '@system-inc/base-foundation/orm/decorators/OrmCreateDateColumn';
import { OrmPrimaryAutoColumn } from '@system-inc/base-foundation/orm/decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '@system-inc/base-foundation/orm/decorators/OrmTable';
import { OrmUpdateDateColumn } from '@system-inc/base-foundation/orm/decorators/OrmUpdateDateColumn';
import { OrmTrackingEntity } from '@system-inc/base-foundation/orm/entity/OrmTrackingEntity';

@OrmTable('note')
export class NoteEntity extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 255 })
    declare title: string;

    @OrmColumn({ kind: 'text' })
    declare content: string;

    @OrmCreateDateColumn()
    declare createdAt: Date;

    @OrmUpdateDateColumn()
    declare updatedAt: Date;
}
```

Three rules to notice:

- **Extend `OrmTrackingEntity`.** It gives your entity change tracking (updates only send the fields you actually changed) and the static `from(...)` constructor you'll use to create rows.
- **Every column property uses `declare`.** The base class installs tracking accessors for each column at construction time; `declare` makes the property type-only so those accessors survive. A Base lint rule enforces this, so you can't forget it.
- **Every column states its database type explicitly**: `{ kind: 'varchar', length: 255 }`, `{ kind: 'text' }`. No inference, no surprises in the generated SQL. `@OrmPrimaryAutoColumn('uuid')` is a primary key that generates a UUID for you; the create/update date columns maintain themselves.

## Configure the database

Tell your worker it has a database. In `settings.ts`, add an `orm` block:

```ts
import { D1Provider } from '@system-inc/base-foundation/orm/database/adapter/drizzle/sqlite/D1Provider';
import { NoteEntity } from './source/entities/NoteEntity';
```

```ts
    orm: {
        '@default': {
            adapterType: 'drizzle',
            databaseType: { dialect: 'sqlite', driver: 'd1' },
            adapter: D1Provider,
            binding: 'DATABASE',
            entities: [NoteEntity],
        },
    },
```

The ORM rides on Drizzle underneath. `'@default'` names this database (a worker can have several); `binding: 'DATABASE'` is the Cloudflare binding it attaches to; `entities` lists every entity that lives in it.

Then declare the matching D1 binding in `wrangler.toml` under the development environment:

```toml
[env.Development]
name = "app"
d1_databases = [
    { binding = 'DATABASE', database_name = 'app-db', database_id = 'local-dev', migrations_table = '__drizzle_migrations_app', migrations_dir = './database/@default/drizzle/migrations' },
]
```

For local development wrangler simulates D1 on your machine, so a placeholder `database_id` is fine; you'll create the real database when you [deploy](./05-deploy-to-cloudflare.md). The `migrations_table` is named per worker (`__drizzle_migrations_<worker>`, with `-` folded to `_`) so workers sharing a database keep independent migration histories; `base check` validates that your `orm` settings and wrangler bindings line up, including that this table name matches the one Base's migration commands use.

## Generate and apply the migration

Base derives SQL migrations from your entities, so you never hand-write schema SQL. Generate one:

```bash
npx base orm schema:generate -w app
```

This diffs your entities against the last known schema and writes a numbered `.sql` migration into `workers/app/database/@default/drizzle/migrations/`. Open it and read it: it's the `CREATE TABLE` you'd expect. Migrations are files in your repo: reviewed in PRs, versioned with your code.

Apply it to your local database:

```bash
npx base orm migration:run -w app --local
```

The `--local` flag targets wrangler's local D1, the same simulated database `base develop` reads. Without it, the command applies migrations to the real remote D1, which is exactly what you'll want at [deploy time](./05-deploy-to-cloudflare.md), but not yet.

Two more ORM commands worth knowing as you work: `base orm db:studio` opens a browser GUI over your database, and `base orm db:reset --local` wipes local state when you want a clean slate.

## Rewrite NoteService against the database

Replace the in-memory array with a repository. Update `workers/app/source/services/NoteService.ts`:

```ts
import { Injectable } from '@system-inc/base-foundation/dependency-injection/decorators/Injectable';
import { HttpErrors } from '@system-inc/base-foundation/error/HttpErrors';
import { OrmRepository } from '@system-inc/base-foundation/orm/database/repository/OrmRepository';
import { InjectRepository } from '@system-inc/base-foundation/orm/decorators/InjectRepository';
import { HttpBody } from '@system-inc/base-foundation/router/decorators/HttpBody';
import { HttpPath } from '@system-inc/base-foundation/router/decorators/HttpPath';
import { HttpRoute } from '@system-inc/base-foundation/router/decorators/HttpRoute';
import { HttpService } from '@system-inc/base-foundation/router/decorators/HttpService';
import { SerializableField } from '@system-inc/base-foundation/serialization/decorators/SerializableField';
import { SerializableObject } from '@system-inc/base-foundation/serialization/decorators/SerializableObject';
import { VerifyIsNotEmpty } from '@system-inc/base-foundation/validation/decorators/VerifyIsNotEmpty';
import { NoteEntity } from '../entities/NoteEntity';

@SerializableObject()
export class CreateNoteInput {
    @VerifyIsNotEmpty()
    @SerializableField(() => String)
    title: string;

    @SerializableField(() => String)
    content: string;
}

@Injectable()
@HttpService()
export class NoteService {
    constructor(
        @InjectRepository(NoteEntity)
        private readonly notes: OrmRepository<NoteEntity>,
    ) {}

    @HttpRoute('POST', '/notes')
    async create(
        @HttpBody(() => CreateNoteInput) input: CreateNoteInput,
    ): Promise<NoteEntity> {
        const note = NoteEntity.from({
            title: input.title,
            content: input.content,
        });
        await this.notes.insert(note);
        return note;
    }

    @HttpRoute('GET', '/notes')
    async list(): Promise<{ notes: NoteEntity[] }> {
        return { notes: await this.notes.find() };
    }

    @HttpRoute('GET', '/notes/:id')
    async get(@HttpPath('id') id: string): Promise<NoteEntity> {
        const note = await this.notes.findOne({ where: { id } });
        if (!note) {
            throw HttpErrors.notFound({ message: 'Note not found.' });
        }
        return note;
    }
}
```

What changed:

- **`@Injectable()` plus a constructor**: the service now takes dependencies, so it opts into constructor injection. `@InjectRepository(NoteEntity)` hands you a typed `OrmRepository<NoteEntity>` bound to the `'@default'` database; the entity type flows through, so the repository's methods are fully typed.
- **Writes are explicit.** Build rows with `NoteEntity.from({...})`, then `insert`; there is no `save`-style upsert-by-accident (`insert`, `update`, `upsert`, and `delete` are separate operations).
- **`findOne({ where: { id } })`**: a bare value in `where` means equality. Richer filters (`like`, `gte`, `between`, `inArray`, …) are importable functions you'll meet in the how-to guides.
- Need more than one entity, or the database itself? `@InjectDatabase()` injects the whole `OrmDatabase`, and `database.getRepository(Entity)` returns the same repositories.
- The route shapes, the validated input class, and the error handling didn't change at all. The ORM slots into the same service you already had.

Since `id` is now a UUID string, the `() => Number` coercion is gone from `@HttpPath`.

## Try it

With the dev server running:

```bash
curl -X POST http://localhost:3000/notes \
    -H 'Content-Type: application/json' \
    -d '{"title": "Persistent note", "content": "This one survives."}'
```

The response now carries a generated UUID `id` plus `createdAt`/`updatedAt`. Restart the dev server, then:

```bash
curl http://localhost:3000/notes
```

Your note is still there. That's D1 on disk, migrated and typed end to end: entity class → generated SQL → repository → JSON response.

Next: [Add GraphQL](./04-add-graphql.md), which exposes the same notes over a typed GraphQL API in about ten lines.
