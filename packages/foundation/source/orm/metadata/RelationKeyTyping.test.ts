// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmTrackingEntity } from '../entity/OrmTrackingEntity';
import {
    OrmManyToOneOptions,
    OrmOneToManyOptions,
} from './OrmRelationMetadata';

// Real entities: relations are typed as entity classes, so `RelationKey`
// resolves to just the relation property keys.
class RkUser extends OrmTrackingEntity {
    declare id: string;
    declare name: string;
    declare posts?: RkPost[];
}

class RkPost extends OrmTrackingEntity {
    declare id: string;
    declare title: string;
    declare author?: RkUser;
}

// A target that types its relations with `Readonly<>` (immutable entities, as
// base-modules does). `Readonly<>` strips the private brand of the entity base
// class, so a nominal `extends OrmTrackingEntity` check would miss these — the
// structural check must still see them as relations.
class RkReadonlyOwner extends OrmTrackingEntity {
    declare id: string;
    declare name: string;
    declare profile?: Readonly<RkUser>;
    declare posts?: readonly Readonly<RkPost>[];
    declare tags?: ReadonlyArray<Readonly<RkPost>>;
}

// A target whose "relation" isn't an entity — `RelationKey` can't identify a
// relation key and falls back to `string` so the option stays usable.
class PlainTarget {
    declare id: string;
    declare note: { text: string };
}

// Valid relation keys compile.
const validToMany: OrmOneToManyOptions<RkPost> = { inverseSide: 'author' };
const validToOne: OrmManyToOneOptions<RkUser> = { inverseSide: 'posts' };

// @ts-expect-error 'title' is a scalar column, not a relation.
const columnKey: OrmOneToManyOptions<RkPost> = { inverseSide: 'title' };
// @ts-expect-error 'missing' is not a property of RkPost.
const missingKey: OrmOneToManyOptions<RkPost> = { inverseSide: 'missing' };
// @ts-expect-error 'name' is a scalar column, not a relation.
const columnKeyToOne: OrmManyToOneOptions<RkUser> = { inverseSide: 'name' };

// Readonly-typed relations are still recognized as relation keys.
const readonlyOne: OrmManyToOneOptions<RkReadonlyOwner> = {
    inverseSide: 'profile',
};
const readonlyMany: OrmManyToOneOptions<RkReadonlyOwner> = {
    inverseSide: 'posts',
};
const readonlyArray: OrmManyToOneOptions<RkReadonlyOwner> = {
    inverseSide: 'tags',
};
const readonlyScalar: OrmManyToOneOptions<RkReadonlyOwner> = {
    // @ts-expect-error 'name' is a scalar column even alongside readonly relations.
    inverseSide: 'name',
};

// Fallback: an arbitrary string is accepted when no relation keys are found.
const fallback: OrmOneToManyOptions<PlainTarget> = { inverseSide: 'whatever' };

describe('RelationKey typing for inverseSide', () => {
    it('accepts relation keys and falls back to string when none are typed', () => {
        // Runtime assertions exist only so jest has something to run; the real
        // coverage is the @ts-expect-error checks above, enforced by tsc.
        expect(validToMany.inverseSide).toBe('author');
        expect(validToOne.inverseSide).toBe('posts');
        expect(columnKey.inverseSide).toBe('title');
        expect(missingKey.inverseSide).toBe('missing');
        expect(columnKeyToOne.inverseSide).toBe('name');
        expect(readonlyOne.inverseSide).toBe('profile');
        expect(readonlyMany.inverseSide).toBe('posts');
        expect(readonlyArray.inverseSide).toBe('tags');
        expect(readonlyScalar.inverseSide).toBe('name');
        expect(fallback.inverseSide).toBe('whatever');
    });
});
