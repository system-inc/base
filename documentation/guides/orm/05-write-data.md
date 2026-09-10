---
title: Write Data
description: 'Explicit inserts, change-tracked updates, upserts, and deletes: no save-and-hope.'
---

Writes in Base are explicit operations. There is no generic `save()` that guesses between insert and update — you say what you mean, and the SQL matches.

## Insert

Build the row with the static `from(...)` constructor, then insert:

```ts
const user = UserEntity.from({
    name: 'Ada',
    email: 'ada@example.com',
    active: true,
});
await this.users.insert(user);

// generated values are now populated
console.log(user.id, user.createdAt);
```

`insert` sends every column you set. Fields you didn't set fall to their database defaults.

## Update

Load, mutate, update. Change tracking means only the fields you actually touched are sent:

```ts
const user = await this.users.findOne({ where: { id } });
if (!user) throw HttpErrors.notFound({ message: 'User not found.' });

user.name = 'Ada Lovelace';
await this.users.update(user); // UPDATE ... SET name = ? — nothing else
```

This is the payoff of `OrmTrackingEntity` and the `declare` rule from [Define an Entity](./01-define-an-entity.md): every property is an accessor that records changes, so concurrent writers touching different fields don't clobber each other.

## Upsert and delete

```ts
await this.users.upsert(user); // insert, or update on conflict
await this.users.delete(user);
```

## Bulk writes by condition

`OrmDatabase.update` and `OrmDatabase.delete` also take a `where`-style conditions object instead of an entity, for sweeps like retention:

```ts
await this.db.delete(LogEntity, { createdAt: lt(cutoff) });
```

Hosted MySQL (PlanetScale) aborts any single statement that touches more than 100,000 rows, and even under that cap a wide delete holds locks and replication for its whole duration. Bound each statement with `limit` and loop until a batch comes back short:

```ts
const batchSize = 10_000;
let affectedRows: number | undefined;
do {
    ({ affectedRows } = await this.db.delete(
        LogEntity,
        { createdAt: lt(cutoff) },
        { limit: batchSize, order: { createdAt: 'ASC' } },
    ));
} while (affectedRows === batchSize);
```

`order` picks which matching rows go first (oldest, here); without `limit` it has no effect. The same options work on `update`. Every Base backend accepts them: MySQL natively, and Durable Object, D1, and better-sqlite3 SQLite are all compiled with `SQLITE_ENABLE_UPDATE_DELETE_LIMIT`.

Empty conditions are refused (that would address every row); clear a table with `truncate` instead.

## Batch writes

`writeBatch` groups multiple operations into one round trip — valuable on D1, where each statement is a network hop. See the reference for `OrmBatchOperation`.

## What to remember

- **Create = `Entity.from({...})` + `insert`.** `from` builds a tracked instance; a plain object literal won't do.
- **`update` requires a loaded (tracked) entity**: that's where the changed-field list comes from.
- **Bulk deletes and updates loop with `{ limit }`**: PlanetScale caps one statement at 100k rows, so a retention sweep batches until a short result.
- **`truncate`** exists for tables declared `@OrmTable(name, { truncatable: true })` — a deliberate opt-in, mostly for tests.
