// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmConfiguration } from '../../../configuration/BaseConfiguration';
import { OrmColumn } from '../../decorators/OrmColumn';
import { OrmPrimaryAutoColumn } from '../../decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '../../decorators/OrmTable';
import { OrmTrackingEntity } from '../../entity/OrmTrackingEntity';
import { OrmAdapter } from '../adapter/OrmAdapter';
import { OrmDatabaseImpl } from './OrmDatabaseImpl';

@OrmTable('lookup_alpha')
class LookupAlphaEntity extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 50 })
    declare name: string;
}

@OrmTable('lookup_beta')
class LookupBetaEntity extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;
}

function createDatabase(): OrmDatabaseImpl {
    const configuration = {
        databaseName: '@default',
        entities: [LookupAlphaEntity, LookupBetaEntity],
        adapterType: 'drizzle',
        databaseType: { dialect: 'sqlite', driver: 'better-sqlite' },
    } as unknown as OrmConfiguration;
    // The lookup methods never touch the adapter.
    return new OrmDatabaseImpl(configuration, {} as unknown as OrmAdapter);
}

describe('OrmDatabaseImpl table-name lookups', () => {
    it('returns the registered entity classes', () => {
        const database = createDatabase();
        expect(database.getEntities()).toEqual([
            LookupAlphaEntity,
            LookupBetaEntity,
        ]);
    });

    it('resolves an entity by its table name', () => {
        const database = createDatabase();
        expect(database.getEntityByTableName('lookup_alpha')).toBe(
            LookupAlphaEntity,
        );
        expect(database.getEntityByTableName('lookup_beta')).toBe(
            LookupBetaEntity,
        );
    });

    it('returns undefined for an unregistered table name', () => {
        const database = createDatabase();
        expect(database.getEntityByTableName('lookup_alpha')).toBeDefined(); // primes the cache
        expect(database.getEntityByTableName('not_a_table')).toBeUndefined();
    });
});

describe('OrmDatabaseImpl entity de-duplication', () => {
    it('de-duplicates an entity registered as both owned and external', () => {
        const configuration = {
            databaseName: '@default',
            entities: [LookupAlphaEntity, LookupBetaEntity],
            // Alpha is also referenced externally (e.g. another module's
            // orm.externalEntities) — must not appear twice.
            externalEntities: [LookupAlphaEntity],
            adapterType: 'drizzle',
            databaseType: { dialect: 'sqlite', driver: 'better-sqlite' },
        } as unknown as OrmConfiguration;
        const database = new OrmDatabaseImpl(
            configuration,
            {} as unknown as OrmAdapter,
        );
        expect(database.getEntities()).toEqual([
            LookupAlphaEntity,
            LookupBetaEntity,
        ]);
    });
});

describe('OrmDatabaseImpl entity-ownership guard', () => {
    it('resolves a repository for an entity registered to this database', () => {
        const database = createDatabase();
        expect(() => database.getRepository(LookupAlphaEntity)).not.toThrow();
    });

    it('throws a clear error for an entity not registered to this database', () => {
        @OrmTable('lookup_gamma')
        class LookupGammaEntity extends OrmTrackingEntity {
            @OrmPrimaryAutoColumn('uuid')
            declare id: string;
        }
        const database = createDatabase();
        expect(() => database.getRepository(LookupGammaEntity)).toThrow(
            /not registered for database "@default"/,
        );
    });
});
