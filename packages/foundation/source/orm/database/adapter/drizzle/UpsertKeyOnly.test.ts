// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import Database from 'better-sqlite3';
import { AnySQLiteTable } from 'drizzle-orm/sqlite-core';

import { OrmConfiguration } from '../../../../configuration/BaseConfiguration';
import { OrmColumn } from '../../../decorators/OrmColumn';
import { OrmPrimaryKey } from '../../../decorators/OrmPrimaryKey';
import { OrmTable } from '../../../decorators/OrmTable';
import { OrmTrackingEntity } from '../../../entity/OrmTrackingEntity';
import { ormRequireTable } from '../../../metadata/OrmSchemaRegistry';
import { OrmSchemaBuilderDrizzleSQLite } from '../../../schema/drizzle/OrmSchemaBuilderDrizzleSQLite';
import { OrmDatabaseImpl } from '../../internal/OrmDatabaseImpl';
import { BetterSQLiteAdapter } from './sqlite/BetterSQLiteAdapter';

// A pure junction row: every column is part of a table-level composite key,
// so there are no non-key columns to update on conflict. This is the shape
// that regressed — the composite PK is declared with @OrmPrimaryKey (not
// per-column `primaryKey` options), so the upsert builder must read the key
// from the table metadata, not from per-column options.
@OrmTable('uko_link')
@OrmPrimaryKey(['aId', 'bId'])
class UkoLink extends OrmTrackingEntity {
    @OrmColumn({ kind: 'varchar', length: 36 })
    declare aId: string;

    @OrmColumn({ kind: 'integer' })
    declare bId: number;
}

function createSqliteDatabase(): {
    database: OrmDatabaseImpl;
    dispose: () => void;
} {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
        CREATE TABLE uko_link (
            aId TEXT NOT NULL,
            bId INTEGER NOT NULL,
            PRIMARY KEY (aId, bId)
        );
    `);

    const schema = new OrmSchemaBuilderDrizzleSQLite().createSchema([
        ormRequireTable(UkoLink),
    ]);
    const adapter = new BetterSQLiteAdapter(
        sqlite,
        schema as Record<string, AnySQLiteTable>,
        { logging: false },
    );
    const configuration = {
        databaseName: '@default',
        entities: [UkoLink],
        adapterType: 'drizzle',
        databaseType: { dialect: 'sqlite', driver: 'better-sqlite' },
    } as unknown as OrmConfiguration;
    return {
        database: new OrmDatabaseImpl(configuration, adapter),
        dispose: () => sqlite.close(),
    };
}

describe('upsert of a key-only composite junction row', () => {
    it('re-upserting an existing key is an idempotent no-op (no PK collision)', async () => {
        const { database, dispose } = createSqliteDatabase();
        try {
            const repo = database.getRepository(UkoLink);
            await repo.insert(UkoLink.from({ aId: 'p1', bId: 1 }));

            // Must resolve via ON CONFLICT DO NOTHING, not throw a UNIQUE/PK
            // constraint error (the bug: composite PK was missed, so the upsert
            // fell through to a plain insert).
            await expect(
                database.writeBatch((batch) => {
                    batch.upsert(UkoLink.from({ aId: 'p1', bId: 1 }));
                }),
            ).resolves.toBeDefined();

            expect(await repo.find({})).toHaveLength(1);
        } finally {
            dispose();
        }
    });

    it('inserts a new key while no-oping the existing one', async () => {
        const { database, dispose } = createSqliteDatabase();
        try {
            const repo = database.getRepository(UkoLink);
            await repo.insert(UkoLink.from({ aId: 'p1', bId: 1 }));

            await database.writeBatch((batch) => {
                batch.upsert([
                    UkoLink.from({ aId: 'p1', bId: 1 }), // exists → no-op
                    UkoLink.from({ aId: 'p1', bId: 2 }), // new → insert
                ]);
            });

            expect(await repo.find({})).toHaveLength(2);
        } finally {
            dispose();
        }
    });
});
