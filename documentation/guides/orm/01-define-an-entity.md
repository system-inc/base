---
title: Define an Entity
description: Describe a table as a decorated class, with explicit column types, tracked changes, and no surprises in the SQL.
---

An entity is a class whose decorators describe a table. Base derives migrations from it, repositories are typed by it, and change tracking rides on it.

## The shape of an entity

```ts
import { OrmColumn } from '@system-inc/base-foundation/orm/decorators/OrmColumn';
import { OrmCreateDateColumn } from '@system-inc/base-foundation/orm/decorators/OrmCreateDateColumn';
import { OrmPrimaryAutoColumn } from '@system-inc/base-foundation/orm/decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '@system-inc/base-foundation/orm/decorators/OrmTable';
import { OrmUpdateDateColumn } from '@system-inc/base-foundation/orm/decorators/OrmUpdateDateColumn';
import { OrmTrackingEntity } from '@system-inc/base-foundation/orm/entity/OrmTrackingEntity';

@OrmTable('user')
export class UserEntity extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 255 })
    declare name: string;

    @OrmColumn({ kind: 'varchar', length: 255 }, { nullable: true })
    declare email: string | null;

    @OrmColumn({ kind: 'boolean' })
    declare active: boolean;

    @OrmCreateDateColumn()
    declare createdAt: Date;

    @OrmUpdateDateColumn()
    declare updatedAt: Date;
}
```

Three rules, all lint-enforced or migration-relevant:

1. **Extend `OrmTrackingEntity`**: it provides change tracking (updates send only changed fields), the static `from(...)` constructor, and the accessor machinery behind rule 2.
2. **`declare` on every decorated property.** The base class installs tracking accessors per column on the class's prototype (once, on first construction); `declare` keeps the property type-only so those accessors survive. The `base/orm-column-requires-declare` lint rule catches omissions.

    One consequence worth knowing: because columns are prototype accessors, **`{ ...entity }`, `Object.keys(entity)`, and `Object.assign({}, entity)` do not see them**; they see only internal tracking state. To get a plain object, use `entity.toJSON()` (what `JSON.stringify` and `Response.json` already call).

3. **Column types are explicit.** Every `@OrmColumn` states its database type, and nothing is inferred from the TypeScript type, so the generated SQL never surprises you.

## Column types

In `@OrmColumn(type, options?)`, the first argument is a type descriptor:

| Kind          | Descriptor                                                                                                                                          | Notes                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| String        | `{ kind: 'varchar', length: 255 }`, `{ kind: 'char', length: 2 }`, `{ kind: 'text' }`                                                               | `varchar`/`char` require a length                                   |
| Numbers       | `{ kind: 'integer', size: 'int32' }`, `{ kind: 'float' }`, `{ kind: 'double' }`                                                                     | `integer` supports `unsigned`, `increment`                          |
| 64-bit        | `{ kind: 'bigint', mode: 'number' \| 'bigint' }`                                                                                                    | `mode` is required; you must decide how 64-bit values surface in JS |
| Exact decimal | `{ kind: 'decimal', precision, scale, mode: ... }`                                                                                                  | for money-like values                                               |
| Other         | `{ kind: 'boolean' }`, `{ kind: 'datetime' }`, `{ kind: 'uuid' }`, `{ kind: 'json' }`, `{ kind: 'bytes', size }`, `{ kind: 'enum', values: [...] }` |                                                                     |

The second argument holds column options like `{ nullable: true }`; pair it with `| null` in the TypeScript type.

## Primary keys and date columns

- `@OrmPrimaryAutoColumn('uuid')`: a primary key that generates its value for you.
- `@OrmPrimaryKey(...)`: for natural or composite keys (see the reference).
- `@OrmCreateDateColumn()` / `@OrmUpdateDateColumn()`: set on insert / maintained on update automatically.

Indexes and uniqueness have their own decorators: `@OrmColumnIndex`, `@OrmColumnUnique`, `@OrmColumnUniqueIndex` on columns, and `@OrmTableIndex`, `@OrmTableUnique`, `@OrmTableUniqueIndex` on the class.

On MySQL, a long text column can't be indexed whole: InnoDB caps an index key at 3072 bytes, and utf8mb4 reserves 4 bytes per declared character, so a `varchar(1024)` alone is over the cap. Declare a **prefix index** instead, an index over the first N characters:

```ts
@OrmTableIndex(['postId', { column: 'title', prefixLength: 191 }])
```

Schema generation checks the math for you: an index MySQL would reject with `errno 1071` fails at generate time with the offending index named, instead of half-applying a migration. SQLite has no key-length ceiling, so it ignores `prefixLength` and indexes the whole column.

## Register the entity

An entity exists once it's listed in a database's `entities` in `settings.ts`:

```ts
    orm: {
        '@default': {
            // ...adapter config...
            entities: [UserEntity],
        },
    },
```

Then generate a migration for it; see [Migrations](./03-migrations.md).
