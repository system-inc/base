---
title: Relations
description: Declare many-to-one, one-to-many, and one-to-one relations, and load them in queries.
---

Relations are declared with decorators on entity properties, always as **optional** properties (`?`) — a relation may simply not be loaded, and the `relation-must-be-optional` lint rule enforces the honesty.

## Many-to-one and one-to-many

The owning side declares the foreign-key column explicitly, then points the relation at it:

```ts
import { OrmManyToOne } from '@system-inc/base-foundation/orm/decorators/OrmManyToOne';
import { OrmOneToMany } from '@system-inc/base-foundation/orm/decorators/OrmOneToMany';

@OrmTable('post')
export class PostEntity extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'uuid' })
    declare authorId: string;

    @OrmManyToOne(() => UserEntity, { joinColumn: 'authorId' })
    declare author?: UserEntity;
}
```

And the inverse side names the property that points back:

```ts
@OrmTable('user')
export class UserEntity extends OrmTrackingEntity {
    // ...columns...

    @OrmOneToMany(() => PostEntity, { inverseSide: 'author' })
    declare posts?: PostEntity[];
}
```

Note the pattern: the foreign key (`authorId`) is a real, explicit column you declared — the relation decorates it rather than conjuring it. Setting `post.authorId` is how you write the relationship.

## One-to-one

`@OrmOneToOne(() => Profile, { joinColumn: 'profileId' })` follows the same owning-side/`joinColumn` convention, with `@OrmJoinColumn` available for finer control.

## No many-to-many: On purpose

There is no `@OrmManyToMany`. A many-to-many is always a real junction table with a name and, sooner or later, its own columns, so you model it as one:

```ts
@OrmTable('post_tag')
export class PostTagEntity extends OrmTrackingEntity {
    @OrmColumn({ kind: 'uuid' })
    declare postId: string;

    @OrmColumn({ kind: 'uuid' })
    declare tagId: string;

    @OrmManyToOne(() => PostEntity, { joinColumn: 'postId' })
    declare post?: PostEntity;

    @OrmManyToOne(() => TagEntity, { joinColumn: 'tagId' })
    declare tag?: TagEntity;
}
```

When the day comes to add `addedAt` or `addedBy`, it's a column, not a migration crisis.

## Loading relations

Relations load only when you ask — there's no implicit lazy loading. Use the `relations` option on any find:

```ts
const post = await this.posts.findOne({
    where: { id },
    relations: { author: true },
});

// nested
const user = await this.users.findOne({
    where: { id },
    relations: { posts: { comments: true } },
});
```

Unloaded relations are simply `undefined` — which is why the properties are optional.
