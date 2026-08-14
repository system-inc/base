---
title: Query Data
description: 'Typed repository reads: equality shorthand, filter functions, ordering, and pagination.'
---

Inject a repository and read through it. All examples assume:

```ts
import { OrmRepository } from '@system-inc/base-foundation/orm/database/repository/OrmRepository';
import { InjectRepository } from '@system-inc/base-foundation/orm/decorators/InjectRepository';

    constructor(
        @InjectRepository(UserEntity)
        private readonly users: OrmRepository<UserEntity>,
    ) {}
```

## Find one, find many

```ts
const user = await this.users.findOne({ where: { id } }); // UserEntity | null

const active = await this.users.find({ where: { active: true } }); // UserEntity[]

const all = await this.users.find(); // everything
```

A bare value in `where` means equality. Multiple keys combine with AND.

## Filter functions

Anything beyond equality is an imported filter function — one import per operator, so your bundle only carries what you use:

```ts
import { between } from '@system-inc/base-foundation/orm/filters/OrmBetweenFilter';
import { gte } from '@system-inc/base-foundation/orm/filters/OrmGteFilter';
import { inArray } from '@system-inc/base-foundation/orm/filters/OrmInArrayFilter';
import { isNotNull } from '@system-inc/base-foundation/orm/filters/OrmIsNotNullFilter';
import { like } from '@system-inc/base-foundation/orm/filters/OrmLikeFilter';

const results = await this.users.find({
    where: {
        name: like('A%'),
        age: between(18, 65),
        email: isNotNull(),
        status: inArray(['active', 'trial']),
    },
});
```

The full set: `equals`, `notEquals`, `like`, `notLike`, `gt`, `gte`, `lt`, `lte`, `between`, `notBetween`, `inArray`, `notInArray`, `isNull`, `isNotNull` — each from `@system-inc/base-foundation/orm/filters/Orm<Name>Filter`.

## Order, limit, offset

```ts
const page = await this.users.find({
    where: { active: true },
    order: { createdAt: 'DESC' },
    limit: 20,
    offset: 40,
});
```

## Counting

```ts
const total = await this.users.count({ where: { active: true } });

const [rows, count] = await this.users.findAndCount({
    where: { active: true },
    limit: 20,
});
```

## Loading relations

Pass `relations` to any find — see [Relations](./02-relations.md#loading-relations):

```ts
const post = await this.posts.findOne({
    where: { id },
    relations: { author: true },
});
```
