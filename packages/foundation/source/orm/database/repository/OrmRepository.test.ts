// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { OrmColumn } from '../../decorators/OrmColumn';
import { OrmCreateDateColumn } from '../../decorators/OrmCreateDateColumn';
import { OrmPrimaryAutoColumn } from '../../decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '../../decorators/OrmTable';
import { OrmUpdateDateColumn } from '../../decorators/OrmUpdateDateColumn';
import { OrmTrackingEntity } from '../../entity/OrmTrackingEntity';
import { OrmInsertResult } from '../../interfaces/result/OrmInsertResult';
import { ormRequireTable } from '../../metadata/OrmSchemaRegistry';
import { OrmSettings } from '../../settings/OrmSettings';
import { OrmAdapterType } from '../adapter/OrmAdapterType';
import { OrmDatabaseImpl } from '../internal/OrmDatabaseImpl';
import { OrmRepository } from './OrmRepository';

@OrmTable('OrmRepositoryTest_serial')
class SerialEntity extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('serial')
    declare id: number;

    @OrmColumn({ kind: 'varchar', length: 50 })
    declare name: string;
}

@OrmTable('OrmRepositoryTest_uuid')
class UuidEntity extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 50 })
    declare name: string;
}

@OrmTable('OrmRepositoryTest_bigserial')
class BigSerialEntity extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('serial', 'int64')
    declare id: bigint;

    @OrmColumn({ kind: 'varchar', length: 50 })
    declare name: string;
}

@OrmTable('OrmRepositoryTest_ts')
class TimestampEntity extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmCreateDateColumn({ name: 'createdAt' })
    declare createdAt: Date;

    // Non-nullable (the default): initialized on insert.
    @OrmUpdateDateColumn({ name: 'updatedAt' })
    declare updatedAt: Date;
}

@OrmTable('OrmRepositoryTest_ts_nullable')
class NullableTimestampEntity extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmCreateDateColumn({ name: 'createdAt' })
    declare createdAt: Date;

    // Nullable override: left null on insert (null-until-first-update).
    @OrmUpdateDateColumn({ name: 'updatedAt', nullable: true })
    declare updatedAt: Date | null;
}

/**
 * Build a repository whose adapter is stubbed to return `insertedId` for every
 * insert (mimicking the driver returning a DB-generated key). The transformed
 * values aren't asserted on, so the stub ignores them.
 */
function repoFor<E extends OrmTrackingEntity>(
    target: Constructor<E>,
    insertedId: string | number | bigint | undefined,
): OrmRepository<E> {
    const adapter = {
        insert: async (): Promise<OrmInsertResult> => ({
            affectedRows: 1,
            insertedId,
        }),
    };
    const db = {
        getAdapter: async () => adapter,
    } as unknown as OrmDatabaseImpl<OrmSettings<OrmAdapterType>>;
    return new OrmRepository(target, ormRequireTable(target), db);
}

describe('OrmRepository.insert serial id back-population', () => {
    it('writes a DB-generated serial id back onto the entity', async () => {
        const repo = repoFor(SerialEntity, 42);
        const entity = SerialEntity.from({ name: 'a' });

        await repo.insert(entity);

        expect(entity.id).toBe(42);
        // afterInsert clears the dirty set, so the freshly-persisted entity has
        // its id set AND no pending changes.
        expect(Object.keys(entity.getChangedFields())).toHaveLength(0);
    });

    it('preserves int64 serial precision via BigInt', async () => {
        // Beyond Number.MAX_SAFE_INTEGER — must not be coerced through Number.
        const repo = repoFor(BigSerialEntity, '9007199254740993');
        const entity = BigSerialEntity.from({ name: 'big' });

        await repo.insert(entity);

        expect(entity.id).toBe(9007199254740993n);
    });

    it('does not touch a client-assigned uuid primary key', async () => {
        // The adapter still reports an insertedId; it must be ignored for uuid.
        const repo = repoFor(UuidEntity, 999);
        const entity = UuidEntity.from({ name: 'b' });

        await repo.insert(entity);

        // entityBeforeInsert assigned a real uuid; the stub's 999 is not it.
        expect(typeof entity.id).toBe('string');
        expect(entity.id).not.toBe('999');
        expect(entity.id.length).toBeGreaterThan(0);
    });

    it('does not overwrite a serial id that was already set', async () => {
        const repo = repoFor(SerialEntity, 42);
        const entity = SerialEntity.from({ name: 'a' });
        entity.id = 7;

        await repo.insert(entity);

        expect(entity.id).toBe(7);
    });

    it('does not back-populate on a multi-row insert (one id, many rows)', async () => {
        const repo = repoFor(SerialEntity, 42);
        const a = SerialEntity.from({ name: 'a' });
        const b = SerialEntity.from({ name: 'b' });

        await repo.insert([a, b]);

        // A single insertedId can't be mapped across rows, so ids stay unset.
        expect(a.id).toBeUndefined();
        expect(b.id).toBeUndefined();
    });
});

describe('OrmRepository.insert update-date column initialization', () => {
    it('initializes a non-null updatedAt to exactly createdAt on insert', async () => {
        const repo = repoFor(TimestampEntity, undefined);
        const entity = TimestampEntity.from({});

        await repo.insert(entity);

        expect(entity.createdAt).toBeInstanceOf(Date);
        expect(entity.updatedAt).toBeInstanceOf(Date);
        // Same instant => `createdAt === updatedAt` reliably means "never updated".
        expect(entity.updatedAt.getTime()).toBe(entity.createdAt.getTime());
    });

    it('leaves a nullable updatedAt null on insert (null-until-first-update)', async () => {
        const repo = repoFor(NullableTimestampEntity, undefined);
        const entity = NullableTimestampEntity.from({});

        await repo.insert(entity);

        expect(entity.createdAt).toBeInstanceOf(Date);
        expect(entity.updatedAt == null).toBe(true);
    });
});
