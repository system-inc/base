// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import Database from 'better-sqlite3';
import { AnySQLiteTable } from 'drizzle-orm/sqlite-core';

import { OrmConfiguration } from '../../../../configuration/BaseConfiguration';
import { OrmColumn } from '../../../decorators/OrmColumn';
import { OrmPrimaryAutoColumn } from '../../../decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '../../../decorators/OrmTable';
import { OrmUpdateDateColumn } from '../../../decorators/OrmUpdateDateColumn';
import { OrmTrackingEntity } from '../../../entity/OrmTrackingEntity';
import { and } from '../../../filters/OrmAndFilter';
import { equals } from '../../../filters/OrmEqualsFilter';
import { ormRequireTable } from '../../../metadata/OrmSchemaRegistry';
import { OrmSchemaBuilderDrizzleSQLite } from '../../../schema/drizzle/OrmSchemaBuilderDrizzleSQLite';
import { OrmDatabaseImpl } from '../../internal/OrmDatabaseImpl';
import { OrmRepository } from '../../repository/OrmRepository';
import { BetterSQLiteAdapter } from './sqlite/BetterSQLiteAdapter';

@OrmTable('mcu_document', { truncatable: true })
class McuDocument extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 16 })
    declare tenantId: string;

    @OrmColumn({ kind: 'varchar', length: 16 })
    declare status: string;

    @OrmColumn({ kind: 'integer' })
    declare views: number;

    @OrmUpdateDateColumn({ name: 'updatedAt' })
    declare updatedAt: Date;
}

/** Registered on no database here — for the entity-ownership guard. */
@OrmTable('mcu_stranger', { truncatable: true })
class McuStranger extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;
}

function createSqliteDatabase(): {
    database: OrmDatabaseImpl;
    dispose: () => void;
} {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
        CREATE TABLE mcu_document (
            id TEXT PRIMARY KEY,
            tenantId TEXT NOT NULL,
            status TEXT NOT NULL,
            views INTEGER NOT NULL,
            updatedAt INTEGER
        );
    `);
    const schema = new OrmSchemaBuilderDrizzleSQLite().createSchema([
        ormRequireTable(McuDocument),
    ]);
    const adapter = new BetterSQLiteAdapter(
        sqlite,
        schema as Record<string, AnySQLiteTable>,
        { logging: false },
    );
    const configuration = {
        databaseName: '@default',
        entities: [McuDocument],
        adapterType: 'drizzle',
        databaseType: { dialect: 'sqlite', driver: 'better-sqlite' },
    } as unknown as OrmConfiguration;
    return {
        database: new OrmDatabaseImpl(configuration, adapter),
        dispose: () => sqlite.close(),
    };
}

/**
 * Two tenants' documents. Every widening bug below shows up as tenant
 * `a`'s row being touched by a write meant for tenant `b`.
 */
async function seed(database: OrmDatabaseImpl): Promise<void> {
    await database.insertBatch(McuDocument, [
        { id: 'a1', tenantId: 'a', status: 'archived', views: 0 },
        { id: 'b1', tenantId: 'b', status: 'archived', views: 0 },
        { id: 'b2', tenantId: 'b', status: 'live', views: 0 },
    ]);
}

async function rowIds(database: OrmDatabaseImpl): Promise<string[]> {
    const rows = await database.find(McuDocument, { order: { id: 'ASC' } });
    return rows.map((row) => row.id);
}

/**
 * A conditions-based write with an `undefined` condition value used to
 * drop that condition silently — `delete({ tenantId: maybeUndefined,
 * status: 'archived' })` deleted archived rows for every tenant. Every
 * mutation path now refuses it, naming the key.
 */
describe('mutation conditions reject undefined values', () => {
    let context: ReturnType<typeof createSqliteDatabase>;
    let tenantId: string | undefined;

    beforeEach(async () => {
        context = createSqliteDatabase();
        await seed(context.database);
        tenantId = undefined;
    });

    afterEach(() => {
        context.dispose();
    });

    it('delete refuses and names the key, leaving every row', async () => {
        await expect(
            context.database.delete(McuDocument, {
                tenantId,
                status: 'archived',
            }),
        ).rejects.toThrow(/Refusing to delete .*'tenantId'/);
        expect(await rowIds(context.database)).toEqual(['a1', 'b1', 'b2']);
    });

    it('update refuses and changes nothing', async () => {
        await expect(
            context.database.update(
                McuDocument,
                { tenantId, status: 'archived' },
                { status: 'gone' },
            ),
        ).rejects.toThrow(/Refusing to update .*'tenantId'/);
        const archived = await context.database.find(McuDocument, {
            where: { status: 'archived' },
        });
        expect(archived).toHaveLength(2);
    });

    it('updateBatch refuses an operation with an undefined condition', async () => {
        await expect(
            context.database.updateBatch(McuDocument, [
                { conditions: { id: 'b1' }, values: { views: 1 } },
                {
                    conditions: { tenantId, status: 'archived' },
                    values: { views: 9 },
                },
            ]),
        ).rejects.toThrow(/Refusing to update .*'tenantId'/);
    });

    it('deleteBatch refuses an entry with an undefined condition', async () => {
        await expect(
            context.database.deleteBatch(McuDocument, [
                { tenantId, status: 'archived' },
            ]),
        ).rejects.toThrow(/Refusing to delete .*'tenantId'/);
        expect(await rowIds(context.database)).toEqual(['a1', 'b1', 'b2']);
    });

    it('deleteBatch refuses an empty entry', async () => {
        await expect(
            context.database.deleteBatch(McuDocument, [{}]),
        ).rejects.toThrow(/Refusing to delete with empty conditions/);
    });

    it('writeBatch deleteWhere refuses an undefined condition', async () => {
        await expect(
            context.database.writeBatch((batch) => {
                batch.deleteWhere(McuDocument, {
                    tenantId,
                    status: 'archived',
                });
            }),
        ).rejects.toThrow(/Refusing to delete .*'tenantId'/);
        expect(await rowIds(context.database)).toEqual(['a1', 'b1', 'b2']);
    });

    it('increment and decrement refuse an undefined condition', async () => {
        await expect(
            context.database.increment(McuDocument, { tenantId }, 'views'),
        ).rejects.toThrow(/Refusing to increment .*'tenantId'/);
        await expect(
            context.database.decrement(McuDocument, { tenantId }, 'views'),
        ).rejects.toThrow(/Refusing to decrement .*'tenantId'/);
    });

    it('refuses undefined nested inside a filter, naming its path', async () => {
        await expect(
            context.database.delete(McuDocument, {
                status: 'archived',
                tenantId: and(equals('b'), undefined as never),
            }),
        ).rejects.toThrow(/Refusing to delete .*'tenantId\.value\[1\]'/);
        await expect(
            context.database.delete(McuDocument, {
                status: 'archived',
                tenantId: equals(tenantId!),
            }),
        ).rejects.toThrow(/Refusing to delete .*'tenantId\.value'/);
        expect(await rowIds(context.database)).toEqual(['a1', 'b1', 'b2']);
    });

    it('a fully scoped write still runs, touching only its rows', async () => {
        const result = await context.database.delete(McuDocument, {
            tenantId: 'b',
            status: 'archived',
        });
        expect(result.affectedRows).toBe(1);
        expect(await rowIds(context.database)).toEqual(['a1', 'b2']);
    });

    it('reads keep "undefined means no filter" (optional-filter building)', async () => {
        const rows = await context.database.find(McuDocument, {
            where: { tenantId, status: 'archived' },
            order: { id: 'ASC' },
        });
        expect(rows.map((row) => row.id)).toEqual(['a1', 'b1']);
    });
});

describe('repository arithmetic and truncate go through the database guards', () => {
    let context: ReturnType<typeof createSqliteDatabase>;
    let repository: OrmRepository<McuDocument>;

    beforeEach(async () => {
        context = createSqliteDatabase();
        await seed(context.database);
        repository = new OrmRepository(
            McuDocument,
            ormRequireTable(McuDocument),
            context.database,
        );
    });

    afterEach(() => {
        context.dispose();
    });

    it('increment refuses empty conditions instead of a silent no-op', async () => {
        await expect(repository.increment({}, 'views')).rejects.toThrow(
            /Refusing to increment with empty conditions/,
        );
    });

    it('decrement refuses an undefined condition', async () => {
        await expect(
            repository.decrement({ tenantId: undefined }, 'views'),
        ).rejects.toThrow(/Refusing to decrement .*'tenantId'/);
    });

    it('increment stamps the update-date column like the database path', async () => {
        await repository.increment({ id: 'b1' }, 'views', 2);
        const row = await context.database.findOne(McuDocument, {
            where: { id: 'b1' },
        });
        expect(row?.views).toBe(2);
        expect(row?.updatedAt).toBeInstanceOf(Date);
    });

    it('truncate refuses an entity this database does not own', async () => {
        const stranger = new OrmRepository(
            McuStranger,
            ormRequireTable(McuStranger),
            context.database,
        );
        await expect(stranger.truncate({ confirm: true })).rejects.toThrow(
            /not registered for database/,
        );
    });
});
