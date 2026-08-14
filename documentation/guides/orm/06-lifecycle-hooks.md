---
title: Lifecycle Hooks
description: Run entity methods around inserts, updates, deletes, and loads.
---

Lifecycle hooks are decorated methods **on the entity itself** that run at defined points in a row's life. Use them for normalization and derived fields that must never be forgotten, no matter which service writes the row.

## Available hooks

| Decorator            | Runs                                     |
| -------------------- | ---------------------------------------- |
| `@OrmBeforeInsert()` | just before the entity is inserted       |
| `@OrmAfterInsert()`  | after the insert completes               |
| `@OrmBeforeUpdate()` | just before an update is written         |
| `@OrmAfterUpdate()`  | after the update completes               |
| `@OrmBeforeDelete()` | just before a delete                     |
| `@OrmAfterDelete()`  | after the delete completes               |
| `@OrmAfterLoad()`    | after a row is materialized from a query |

Each imports from its own path: `@system-inc/base-foundation/orm/decorators/Orm<Name>`.

## Example

```ts
import { OrmBeforeInsert } from '@system-inc/base-foundation/orm/decorators/OrmBeforeInsert';

@OrmTable('user')
export class UserEntity extends OrmTrackingEntity {
    @OrmColumn({ kind: 'varchar', length: 255 })
    declare email: string;

    // ...other columns...

    @OrmBeforeInsert()
    normalizeEmail(): void {
        this.email = this.email.trim().toLowerCase();
    }
}
```

`@OrmBeforeInsert` is the last chance to normalize or fill fields that persist with the insert; `@OrmBeforeUpdate` plays the same role for updates. Because the hook lives on the entity, the rule holds everywhere the entity is written — services can't forget it.

## Guidance

- Keep hooks about the entity's **own fields**: normalization, checksums, derived values.
- Side effects that reach beyond the row (events, other tables, external calls) belong in services, where dependencies are injectable and the behavior is testable in isolation.
