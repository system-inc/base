// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import Database from 'better-sqlite3';
import { AnySQLiteTable } from 'drizzle-orm/sqlite-core';

import { OrmConfiguration } from '../../../../configuration/BaseConfiguration';
import { OrmColumn } from '../../../decorators/OrmColumn';
import { OrmPrimaryAutoColumn } from '../../../decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '../../../decorators/OrmTable';
import { OrmTrackingEntity } from '../../../entity/OrmTrackingEntity';
import { parentColumn } from '../../../interfaces/find/OrmMappedJoin';
import { ormRequireTable } from '../../../metadata/OrmSchemaRegistry';
import { OrmSchemaBuilderDrizzleSQLite } from '../../../schema/drizzle/OrmSchemaBuilderDrizzleSQLite';
import { OrmDatabaseImpl } from '../../internal/OrmDatabaseImpl';
import { BetterSQLiteAdapter } from './sqlite/BetterSQLiteAdapter';

// Audit findings 9 + 19: mode-bearing bigint/decimal columns corrupted
// (MySQL: lossy float64 through JSON) or failed outright (SQLite: blob
// storage in json_object) when loaded through a mapped join. They now
// ride the JSON as exact digit strings and re-type on hydration.
@OrmTable('bdj_account')
class BdjAccount extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 32 })
    declare name: string;
}

@OrmTable('bdj_ledger_entry')
class BdjLedgerEntry extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'uuid' })
    declare accountId: string;

    // Full-range identifier — the >2^53 case.
    @OrmColumn({ kind: 'bigint', mode: 'bigint' })
    declare externalId: bigint;

    // Ergonomic counter under 2^53.
    @OrmColumn({ kind: 'bigint', mode: 'number' })
    declare sequence: number;

    // Exact money value.
    @OrmColumn({ kind: 'decimal', precision: 20, scale: 4, mode: 'string' })
    declare amount: string;
}

const BIG = 9007199254740993n; // 2^53 + 1 — unrepresentable as float64

function createSqliteDatabase(): {
    database: OrmDatabaseImpl;
    dispose: () => void;
} {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
        CREATE TABLE bdj_account (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL
        );
        CREATE TABLE bdj_ledger_entry (
            id TEXT PRIMARY KEY,
            accountId TEXT NOT NULL,
            externalId BLOB NOT NULL,
            sequence TEXT NOT NULL,
            amount TEXT NOT NULL
        );
    `);
    const schema = new OrmSchemaBuilderDrizzleSQLite().createSchema([
        ormRequireTable(BdjAccount),
        ormRequireTable(BdjLedgerEntry),
    ]);
    const adapter = new BetterSQLiteAdapter(
        sqlite,
        schema as Record<string, AnySQLiteTable>,
        { logging: false },
    );
    const configuration = {
        databaseName: '@default',
        entities: [BdjAccount, BdjLedgerEntry],
        adapterType: 'drizzle',
        databaseType: { dialect: 'sqlite', driver: 'better-sqlite' },
    } as unknown as OrmConfiguration;
    return {
        database: new OrmDatabaseImpl(configuration, adapter),
        dispose: () => sqlite.close(),
    };
}

describe('bigint/decimal columns through mapped joins (sqlite end-to-end)', () => {
    it('joined entities carry exact values with their declared runtime types', async () => {
        const { database, dispose } = createSqliteDatabase();
        try {
            await database.insert(BdjAccount, { id: 'a1', name: 'main' });
            const entryRepo = database.getRepository(BdjLedgerEntry);
            await entryRepo.insert(
                BdjLedgerEntry.from({
                    id: 'l1',
                    accountId: 'a1',
                    externalId: BIG,
                    sequence: 42,
                    amount: '1234.5600',
                }),
            );

            // Control: the direct load is exact.
            const direct = await entryRepo.findOne({ where: { id: 'l1' } });
            expect(direct!.externalId).toBe(BIG);

            // The mapped-join load must agree with it, exactly and typed.
            const accounts = await database
                .getRepository(BdjAccount)
                .find({
                    joins: [
                        {
                            property: 'entries',
                            entity: BdjLedgerEntry,
                            type: 'many',
                            where: { accountId: parentColumn('id') },
                        },
                    ],
                });
            const joined = (
                accounts[0] as unknown as { entries: BdjLedgerEntry[] }
            ).entries[0];
            expect(joined.externalId).toBe(BIG);
            expect(joined.sequence).toBe(42);
            expect(joined.amount).toBe('1234.5600');
        } finally {
            dispose();
        }
    });

    it('updateBatch with bigint values does not throw on the grouping key', async () => {
        // Audit finding 18: JSON.stringify(values) as the grouping key
        // threw "Do not know how to serialize a BigInt" before any SQL.
        const { database, dispose } = createSqliteDatabase();
        try {
            const repo = database.getRepository(BdjLedgerEntry);
            await repo.insert(
                BdjLedgerEntry.from({
                    id: 'l1',
                    accountId: 'a1',
                    externalId: BIG,
                    sequence: 1,
                    amount: '1.0000',
                }),
            );
            const loaded = await repo.findOne({ where: { id: 'l1' } });
            loaded!.externalId = BIG + 1n;
            await expect(repo.update(loaded!)).resolves.toBeDefined();

            const after = await repo.findOne({ where: { id: 'l1' } });
            expect(after!.externalId).toBe(BIG + 1n);
        } finally {
            dispose();
        }
    });
});
