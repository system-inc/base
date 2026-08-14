// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmTrackingEntity } from '../entity/OrmTrackingEntity';
import { OrmDatabase } from './OrmDatabase';
import { OrmReadonlyDatabase } from './OrmReadonlyDatabase';
import { OrmReadonlyRepository } from './repository/OrmReadonlyRepository';
import { OrmRepository } from './repository/OrmRepository';

// A read-only view is opt-in by ANNOTATION alone — a consumer types an injected
// parameter as OrmReadonlyRepository<T> / OrmReadonlyDatabase and keeps using the
// normal @InjectRepository/@InjectDatabase, which resolve the full types. That
// only works while the full types remain structural supersets of the read-only
// interfaces. These assignments lock the contract in BOTH directions, enforced
// by ts-jest: full → read-only must hold (the capability), and read-only → full
// must NOT (proving the read-only surface is genuinely narrower, not accidentally
// equal). A return-type change on either side fails the build.

class RoEntity extends OrmTrackingEntity {
    declare id: string;
    declare name: string;
}

const fullRepo = {} as unknown as OrmRepository<RoEntity>;
const fullDb = {} as unknown as OrmDatabase;

// Capability: the full types ARE read-only views.
const readonlyRepo: OrmReadonlyRepository<RoEntity> = fullRepo;
const readonlyDb: OrmReadonlyDatabase = fullDb;

// @ts-expect-error a read-only repository lacks the write surface, so it is NOT a full repository.
const _repoReverse: OrmRepository<RoEntity> = readonlyRepo;
// @ts-expect-error a read-only database lacks the write surface, so it is NOT a full database.
const _dbReverse: OrmDatabase = readonlyDb;

// Type-only (never executed): a read-only database hands back read-only repositories.
function _getRepositoryReturnsReadonly(
    database: OrmReadonlyDatabase,
): OrmReadonlyRepository<RoEntity> {
    return database.getRepository(RoEntity);
}

describe('OrmReadonly* assignability', () => {
    it('keeps the full ORM types assignable to their read-only views', () => {
        // The real coverage is the type assignments + @ts-expect-error above,
        // enforced by ts-jest; these runtime checks just give jest a body.
        expect(readonlyRepo).toBe(fullRepo);
        expect(readonlyDb).toBe(fullDb);
    });
});
