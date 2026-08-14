// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import Database from 'better-sqlite3';
import { AnySQLiteTable } from 'drizzle-orm/sqlite-core';

import { OrmConfiguration } from '../../../configuration/BaseConfiguration';
import { OrmColumn } from '../../decorators/OrmColumn';
import { OrmPrimaryKey } from '../../decorators/OrmPrimaryKey';
import { OrmTable } from '../../decorators/OrmTable';
import { OrmTrackingEntity } from '../../entity/OrmTrackingEntity';
import { ormRequireTable } from '../../metadata/OrmSchemaRegistry';
import { OrmSchemaBuilderDrizzleSQLite } from '../../schema/drizzle/OrmSchemaBuilderDrizzleSQLite';
import { BetterSQLiteAdapter } from '../adapter/drizzle/sqlite/BetterSQLiteAdapter';
import { OrmDatabaseImpl } from '../internal/OrmDatabaseImpl';

// Audit finding 1 (adversarial-audit-2026-07): an entity carrying a PARTIAL
// composite primary key used to produce a WHERE on only the set components,
// silently widening entity-scoped update/delete/upsert to sibling rows.
@OrmTable('pkc_member')
@OrmPrimaryKey(['accountId', 'deviceId'])
class PkcMember extends OrmTrackingEntity {
    @OrmColumn({ kind: 'varchar', length: 36 })
    declare accountId: string;

    @OrmColumn({ kind: 'varchar', length: 36 })
    declare deviceId: string;

    @OrmColumn({ kind: 'varchar', length: 32 }, { nullable: true })
    declare label: string | null;
}

function createSqliteDatabase(): {
    database: OrmDatabaseImpl;
    dispose: () => void;
} {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
        CREATE TABLE pkc_member (
            accountId TEXT NOT NULL,
            deviceId TEXT NOT NULL,
            label TEXT,
            PRIMARY KEY (accountId, deviceId)
        );
    `);

    const schema = new OrmSchemaBuilderDrizzleSQLite().createSchema([
        ormRequireTable(PkcMember),
    ]);
    const adapter = new BetterSQLiteAdapter(
        sqlite,
        schema as Record<string, AnySQLiteTable>,
        { logging: false },
    );
    const configuration = {
        databaseName: '@default',
        entities: [PkcMember],
        adapterType: 'drizzle',
        databaseType: { dialect: 'sqlite', driver: 'better-sqlite' },
    } as unknown as OrmConfiguration;
    return {
        database: new OrmDatabaseImpl(configuration, adapter),
        dispose: () => sqlite.close(),
    };
}

describe('entity writes require the complete composite primary key', () => {
    let database: OrmDatabaseImpl;
    let dispose: () => void;

    beforeEach(async () => {
        ({ database, dispose } = createSqliteDatabase());
        const repo = database.getRepository(PkcMember);
        await repo.insert(
            PkcMember.from({ accountId: 'a1', deviceId: 'd1', label: 'one' }),
        );
        await repo.insert(
            PkcMember.from({ accountId: 'a1', deviceId: 'd2', label: 'two' }),
        );
    });
    afterEach(() => dispose());

    it('delete with a partial key throws and touches nothing', async () => {
        const repo = database.getRepository(PkcMember);
        const partial = PkcMember.from({ accountId: 'a1' });

        await expect(repo.delete(partial)).rejects.toThrow(
            /primary key column\(s\) deviceId are not set/,
        );
        expect(await database.count(PkcMember)).toBe(2);
    });

    it('update with a partial key throws and touches nothing', async () => {
        const repo = database.getRepository(PkcMember);
        const partial = PkcMember.from({ accountId: 'a1' });
        partial.label = 'clobbered';

        await expect(repo.update(partial)).rejects.toThrow(
            /deviceId are not set/,
        );
        const rows = await repo.find({ where: { accountId: 'a1' } });
        expect(rows.map((row) => row.label).sort()).toEqual(['one', 'two']);
    });

    it('batch delete with a partial key throws before any SQL', async () => {
        const partial = PkcMember.from({ accountId: 'a1' });
        await expect(
            database.writeBatch((batch) => {
                batch.delete(partial);
            }),
        ).rejects.toThrow(/deviceId are not set/);
        expect(await database.count(PkcMember)).toBe(2);
    });

    it('a complete key still updates exactly its own row', async () => {
        const repo = database.getRepository(PkcMember);
        const row = PkcMember.from({ accountId: 'a1', deviceId: 'd1' });
        row.label = 'renamed';
        await repo.update(row);

        const rows = await repo.find({
            where: { accountId: 'a1' },
            order: { deviceId: 'ASC' },
        });
        expect(rows.map((r) => r.label)).toEqual(['renamed', 'two']);
    });
});
