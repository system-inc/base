// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import Database from 'better-sqlite3';
import { AnySQLiteTable } from 'drizzle-orm/sqlite-core';

import { OrmConfiguration } from '../../../../configuration/BaseConfiguration';
import { OrmColumn } from '../../../decorators/OrmColumn';
import { OrmJoinColumn } from '../../../decorators/OrmJoinColumn';
import { OrmManyToOne } from '../../../decorators/OrmManyToOne';
import { OrmOneToMany } from '../../../decorators/OrmOneToMany';
import { OrmPrimaryAutoColumn } from '../../../decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '../../../decorators/OrmTable';
import { OrmTrackingEntity } from '../../../entity/OrmTrackingEntity';
import { ormRequireTable } from '../../../metadata/OrmSchemaRegistry';
import { OrmSchemaBuilderDrizzleSQLite } from '../../../schema/drizzle/OrmSchemaBuilderDrizzleSQLite';
import { OrmDatabaseImpl } from '../../internal/OrmDatabaseImpl';
import { BetterSQLiteAdapter } from './sqlite/BetterSQLiteAdapter';

// Mirrors the real case: a StripeEntitlement has no profileId of its own; you
// filter it through its ProfileEntitlement relation.
@OrmTable('rpf_profile_entitlement')
class RpfProfileEntitlement extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'uuid' })
    declare profileId: string;

    @OrmOneToMany(() => RpfStripeEntitlement, {
        inverseSide: 'profileEntitlement',
    })
    declare stripeEntitlements?: RpfStripeEntitlement[];
}

@OrmTable('rpf_stripe_entitlement')
class RpfStripeEntitlement extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 32 })
    declare sku: string;

    @OrmColumn({ kind: 'uuid' })
    declare profileEntitlementId: string;

    @OrmManyToOne(() => RpfProfileEntitlement, {
        joinColumn: 'profileEntitlementId',
    })
    @OrmJoinColumn({
        name: 'profileEntitlementId',
        referencedColumnName: 'id',
    })
    declare profileEntitlement?: RpfProfileEntitlement;
}


// Audit finding 10: the one-to-many EXISTS branch ignored the inverse
// relation's referencedColumnName and always correlated to the parent PK.
// This pair's child FK references the parent's UNIQUE uuid, not its id.
@OrmTable('rpf_parent_uuid')
class RpfParentUuid extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'uuid' }, { unique: true })
    declare uuid: string;

    @OrmOneToMany(() => RpfChildByUuid, { inverseSide: 'parent' })
    declare children?: RpfChildByUuid[];
}

@OrmTable('rpf_child_by_uuid')
class RpfChildByUuid extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 32 })
    declare sku: string;

    @OrmColumn({ kind: 'uuid' })
    declare parentUuid: string;

    @OrmManyToOne(() => RpfParentUuid, { joinColumn: 'parentUuid' })
    @OrmJoinColumn({ name: 'parentUuid', referencedColumnName: 'uuid' })
    declare parent?: RpfParentUuid;
}

function createSqliteDatabase(): {
    database: OrmDatabaseImpl;
    dispose: () => void;
} {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
        CREATE TABLE rpf_profile_entitlement (
            id TEXT PRIMARY KEY,
            profileId TEXT NOT NULL
        );
        CREATE TABLE rpf_stripe_entitlement (
            id TEXT PRIMARY KEY,
            sku TEXT NOT NULL,
            profileEntitlementId TEXT NOT NULL
        );
        INSERT INTO rpf_profile_entitlement (id, profileId) VALUES
            ('pe1', 'profA'),
            ('pe2', 'profB');
        INSERT INTO rpf_stripe_entitlement (id, sku, profileEntitlementId) VALUES
            ('se1', 'alpha', 'pe1'),
            ('se2', 'beta', 'pe2'),
            ('se3', 'gamma', 'pe1');
        CREATE TABLE rpf_parent_uuid (
            id TEXT PRIMARY KEY,
            uuid TEXT NOT NULL UNIQUE
        );
        CREATE TABLE rpf_child_by_uuid (
            id TEXT PRIMARY KEY,
            sku TEXT NOT NULL,
            parentUuid TEXT NOT NULL
        );
        INSERT INTO rpf_parent_uuid (id, uuid) VALUES
            ('p1', 'uuid-a'),
            ('p2', 'uuid-b');
        INSERT INTO rpf_child_by_uuid (id, sku, parentUuid) VALUES
            ('c1', 'alpha', 'uuid-a'),
            ('c2', 'beta', 'uuid-b');
    `);

    const schema = new OrmSchemaBuilderDrizzleSQLite().createSchema([
        ormRequireTable(RpfProfileEntitlement),
        ormRequireTable(RpfStripeEntitlement),
        ormRequireTable(RpfParentUuid),
        ormRequireTable(RpfChildByUuid),
    ]);
    const adapter = new BetterSQLiteAdapter(
        sqlite,
        schema as Record<string, AnySQLiteTable>,
        { logging: false },
    );
    const configuration = {
        databaseName: '@default',
        entities: [
            RpfProfileEntitlement,
            RpfStripeEntitlement,
            RpfParentUuid,
            RpfChildByUuid,
        ],
        adapterType: 'drizzle',
        databaseType: { dialect: 'sqlite', driver: 'better-sqlite' },
    } as unknown as OrmConfiguration;
    return {
        database: new OrmDatabaseImpl(configuration, adapter),
        dispose: () => sqlite.close(),
    };
}

describe('relation-predicate filtering (where through a relation)', () => {
    let database: OrmDatabaseImpl;
    let dispose: () => void;

    beforeEach(() => {
        ({ database, dispose } = createSqliteDatabase());
    });
    afterEach(() => dispose());

    it('filters a parent by a to-one relation column (find)', async () => {
        const repo = database.getRepository(RpfStripeEntitlement);
        const results = await repo.find({
            where: { profileEntitlement: { profileId: 'profA' } },
            relations: { profileEntitlement: true },
        });

        // se1 + se3 point at pe1 (profA); se2 points at pe2 (profB).
        expect(results.map((r) => r.sku).sort()).toEqual(['alpha', 'gamma']);
        // The declared relation is still loaded alongside the EXISTS filter.
        expect(results[0].profileEntitlement?.profileId).toBe('profA');
    });

    it('counts parents by a to-one relation column', async () => {
        const count = await database.count(RpfStripeEntitlement, {
            where: { profileEntitlement: { profileId: 'profA' } },
        });
        expect(count).toBe(2);
    });

    it('returns nothing when no related row matches', async () => {
        const repo = database.getRepository(RpfStripeEntitlement);
        const results = await repo.find({
            where: { profileEntitlement: { profileId: 'nobody' } },
        });
        expect(results).toHaveLength(0);
    });

    it('filters a parent by a to-many relation column (find)', async () => {
        const repo = database.getRepository(RpfProfileEntitlement);
        // Profile entitlements that have a stripe entitlement with sku 'beta'.
        const results = await repo.find({
            where: { stripeEntitlements: { sku: 'beta' } },
        });
        expect(results.map((r) => r.id)).toEqual(['pe2']);
    });


    it('to-many predicate honors a non-PK referencedColumnName', async () => {
        // Audit finding 10: this used to compile EXISTS(child.parentUuid =
        // parent.id) — correlating the uuid FK to the PK — and match zero.
        const parents = await database.find(RpfParentUuid, {
            where: { children: { sku: 'alpha' } },
        });
        expect(parents.map((parent) => parent.id)).toEqual(['p1']);
    });

    it('combines a relation predicate with an own-column filter', async () => {
        const count = await database.count(RpfStripeEntitlement, {
            where: {
                sku: 'gamma',
                profileEntitlement: { profileId: 'profA' },
            },
        });
        expect(count).toBe(1); // only se3 (sku gamma + profA)
    });
});
