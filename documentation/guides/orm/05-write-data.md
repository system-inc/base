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

## Batch writes

`writeBatch` groups multiple operations into one round trip — valuable on D1, where each statement is a network hop. See the reference for `OrmBatchOperation`.

## What to remember

- **Create = `Entity.from({...})` + `insert`.** `from` builds a tracked instance; a plain object literal won't do.
- **`update` requires a loaded (tracked) entity**: that's where the changed-field list comes from.
- **`truncate`** exists for tables declared `@OrmTable(name, { truncatable: true })` — a deliberate opt-in, mostly for tests.
