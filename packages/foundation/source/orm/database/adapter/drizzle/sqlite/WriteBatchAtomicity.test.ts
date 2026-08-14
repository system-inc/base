// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import Database from 'better-sqlite3';
import { AnySQLiteTable } from 'drizzle-orm/sqlite-core';

import { OrmConfiguration } from '../../../../../configuration/BaseConfiguration';
import { OrmColumn } from '../../../../decorators/OrmColumn';
import { OrmPrimaryAutoColumn } from '../../../../decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '../../../../decorators/OrmTable';
import { OrmTrackingEntity } from '../../../../entity/OrmTrackingEntity';
import { ormRequireTable } from '../../../../metadata/OrmSchemaRegistry';
import { OrmSchemaBuilderDrizzleSQLite } from '../../../../schema/drizzle/OrmSchemaBuilderDrizzleSQLite';
import { OrmDatabaseImpl } from '../../../internal/OrmDatabaseImpl';
import { BetterSQLiteAdapter } from './BetterSQLiteAdapter';

// writeBatch's contract is all-or-none. The async default executor handed an
// async callback to better-sqlite3's synchronous transaction(), which committed
// at the first await — every statement then ran auto-committed outside the
// transaction, so a failing op left its predecessors behind.
@OrmTable('wba_item')
class WbaItem extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 64 })
    declare value: string;
}

function createSqliteDatabase(): {
    database: OrmDatabaseImpl;
    dispose: () => void;
} {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
        CREATE TABLE wba_item (
            id TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `);

    const schema = new OrmSchemaBuilderDrizzleSQLite().createSchema([
        ormRequireTable(WbaItem),
    ]);
    const adapter = new BetterSQLiteAdapter(
        sqlite,
        schema as Record<string, AnySQLiteTable>,
        { logging: false },
    );
    const configuration = {
        databaseName: '@default',
        entities: [WbaItem],
        adapterType: 'drizzle',
        databaseType: { dialect: 'sqlite', driver: 'better-sqlite' },
    } as unknown as OrmConfiguration;
    return {
        database: new OrmDatabaseImpl(configuration, adapter),
        dispose: () => sqlite.close(),
    };
}

describe('better-sqlite3 writeBatch atomicity', () => {
    let database: OrmDatabaseImpl;
    let dispose: () => void;

    beforeEach(() => {
        ({ database, dispose } = createSqliteDatabase());
    });
    afterEach(() => dispose());

    it('persists every operation of a successful batch', async () => {
        const result = await database.writeBatch((batch) => {
            batch.insert(WbaItem.from({ id: 'i1', value: 'a' }));
            batch.insert(WbaItem.from({ id: 'i2', value: 'b' }));
        });

        expect(result.affectedRows).toBe(2);
        const rows = await database.getRepository(WbaItem).find({});
        expect(rows.map((row) => row.id).sort()).toEqual(['i1', 'i2']);
    });

    // The rejection is captured rather than asserted with
    // `.rejects.toThrow()`, which is unreliable for a DRIVER-thrown error:
    // better-sqlite3's SqliteError is a plain constructor calling
    // `Error.call(this)`, so instances carry no [[ErrorData]] slot and jest's
    // isError() falls back to `instanceof Error`. Jest gives every test FILE a
    // fresh realm, but the native addon is initialized once per worker
    // PROCESS — so once a second sqlite test file shares that worker, the
    // errors it receives were built with the first file's Error, fail the
    // `instanceof`, and toThrow reports "Received function did not throw" for
    // a promise that did reject. Which file loads the addon first depends on
    // test scheduling, which made the toThrow form flaky in full runs.
    it('rolls back every operation when a later one fails', async () => {
        const failure = await database
            .writeBatch((batch) => {
                batch.insert(WbaItem.from({ id: 'i1', value: 'a' }));
                // Second insert violates the primary key — the whole batch
                // must fail, including the already-executed first insert.
                batch.insert(WbaItem.from({ id: 'i1', value: 'b' }));
            })
            .then(
                () => undefined,
                (error: unknown) => error,
            );

        expect(failure).toBeDefined();
        expect(String(failure)).toMatch(/UNIQUE constraint failed/);

        const rows = await database.getRepository(WbaItem).find({});
        expect(rows).toHaveLength(0);
    });
});
