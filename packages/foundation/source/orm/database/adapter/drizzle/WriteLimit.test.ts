// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import Database from 'better-sqlite3';
import { AnySQLiteTable } from 'drizzle-orm/sqlite-core';

import { OrmConfiguration } from '../../../../configuration/BaseConfiguration';
import { OrmColumn } from '../../../decorators/OrmColumn';
import { OrmPrimaryAutoColumn } from '../../../decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '../../../decorators/OrmTable';
import { OrmTrackingEntity } from '../../../entity/OrmTrackingEntity';
import { lt } from '../../../filters/OrmLtFilter';
import { ormRequireTable } from '../../../metadata/OrmSchemaRegistry';
import { OrmSchemaBuilderDrizzleSQLite } from '../../../schema/drizzle/OrmSchemaBuilderDrizzleSQLite';
import { OrmDatabaseImpl } from '../../internal/OrmDatabaseImpl';
import { BetterSQLiteAdapter } from './sqlite/BetterSQLiteAdapter';

@OrmTable('wl_log')
class WlLog extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'integer' })
    declare createdAtEpoch: number;

    @OrmColumn({ kind: 'varchar', length: 16 })
    declare status: string;
}

function createSqliteDatabase(): {
    database: OrmDatabaseImpl;
    dispose: () => void;
} {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
        CREATE TABLE wl_log (
            id TEXT PRIMARY KEY,
            createdAtEpoch INTEGER NOT NULL,
            status TEXT NOT NULL
        );
    `);

    const schema = new OrmSchemaBuilderDrizzleSQLite().createSchema([
        ormRequireTable(WlLog),
    ]);
    const adapter = new BetterSQLiteAdapter(
        sqlite,
        schema as Record<string, AnySQLiteTable>,
        { logging: false },
    );
    const configuration = {
        databaseName: '@default',
        entities: [WlLog],
        adapterType: 'drizzle',
        databaseType: { dialect: 'sqlite', driver: 'better-sqlite' },
    } as unknown as OrmConfiguration;
    return {
        database: new OrmDatabaseImpl(configuration, adapter),
        dispose: () => sqlite.close(),
    };
}

/** Ten rows, epochs 1..10, all `stale`. */
async function seed(database: OrmDatabaseImpl): Promise<void> {
    await database.insertBatch(
        WlLog,
        Array.from({ length: 10 }, (_, index) => ({
            id: `row-${index + 1}`,
            createdAtEpoch: index + 1,
            status: 'stale',
        })),
    );
}

async function remainingEpochs(database: OrmDatabaseImpl): Promise<number[]> {
    const rows = await database.find(WlLog, {
        order: { createdAtEpoch: 'ASC' },
    });
    return rows.map((row) => row.createdAtEpoch);
}

/**
 * Conditions-based `delete`/`update` accept `{ limit, order }` so a bulk
 * write can be batched — hosted MySQL aborts a single statement past
 * 100k rows. Exercised on SQLite (better-sqlite3 compiles with
 * `SQLITE_ENABLE_UPDATE_DELETE_LIMIT`, as workerd does), which is the same
 * clause shape Drizzle emits for MySQL.
 */
describe('conditions-based write limit', () => {
    let context: ReturnType<typeof createSqliteDatabase>;

    beforeEach(async () => {
        context = createSqliteDatabase();
        await seed(context.database);
    });

    afterEach(() => {
        context.dispose();
    });

    it('delete removes at most limit rows, oldest first when ordered', async () => {
        const result = await context.database.delete(
            WlLog,
            { createdAtEpoch: lt(8) },
            { limit: 3, order: { createdAtEpoch: 'ASC' } },
        );

        expect(result.affectedRows).toBe(3);
        expect(await remainingEpochs(context.database)).toEqual([
            4, 5, 6, 7, 8, 9, 10,
        ]);
    });

    it('delete honors DESC order', async () => {
        await context.database.delete(
            WlLog,
            { createdAtEpoch: lt(8) },
            { limit: 2, order: { createdAtEpoch: 'DESC' } },
        );

        expect(await remainingEpochs(context.database)).toEqual([
            1, 2, 3, 4, 5, 8, 9, 10,
        ]);
    });

    it('a batch loop drains the match set and stops on a short batch', async () => {
        const batchSize = 4;
        const batches: (number | undefined)[] = [];
        let affectedRows: number | undefined;
        do {
            ({ affectedRows } = await context.database.delete(
                WlLog,
                { createdAtEpoch: lt(11) },
                { limit: batchSize },
            ));
            batches.push(affectedRows);
        } while (affectedRows === batchSize);

        expect(batches).toEqual([4, 4, 2]);
        expect(await remainingEpochs(context.database)).toEqual([]);
    });

    it('delete without options still removes every matching row', async () => {
        const result = await context.database.delete(WlLog, {
            createdAtEpoch: lt(8),
        });

        expect(result.affectedRows).toBe(7);
        expect(await remainingEpochs(context.database)).toEqual([8, 9, 10]);
    });

    it('update changes at most limit rows in the requested order', async () => {
        const result = await context.database.update(
            WlLog,
            { status: 'stale' },
            { status: 'swept' },
            { limit: 3, order: { createdAtEpoch: 'ASC' } },
        );

        expect(result.affectedRows).toBe(3);
        const swept = await context.database.find(WlLog, {
            where: { status: 'swept' },
            order: { createdAtEpoch: 'ASC' },
        });
        expect(swept.map((row) => row.createdAtEpoch)).toEqual([1, 2, 3]);
    });

    it.each([0, -1, 1.5, Number.NaN])(
        'rejects a limit of %p before touching the database',
        async (limit) => {
            await expect(
                context.database.delete(
                    WlLog,
                    { createdAtEpoch: lt(8) },
                    { limit },
                ),
            ).rejects.toThrow(/limit must be a positive integer/);
            await expect(
                context.database.update(
                    WlLog,
                    { status: 'stale' },
                    { status: 'swept' },
                    { limit },
                ),
            ).rejects.toThrow(/limit must be a positive integer/);
            expect(await remainingEpochs(context.database)).toHaveLength(10);
        },
    );

    it('rejects an order key that is not a column', async () => {
        await expect(
            context.database.delete(
                WlLog,
                { createdAtEpoch: lt(8) },
                {
                    limit: 1,
                    order: { nope: 'ASC' } as never,
                },
            ),
        ).rejects.toThrow(/nope/);
        expect(await remainingEpochs(context.database)).toHaveLength(10);
    });
});
