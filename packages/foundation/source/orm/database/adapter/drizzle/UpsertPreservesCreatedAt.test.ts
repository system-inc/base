// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import Database from 'better-sqlite3';
import { AnyMySqlTable } from 'drizzle-orm/mysql-core';
import { drizzle as drizzleMySqlProxy } from 'drizzle-orm/mysql-proxy';
import { AnySQLiteTable } from 'drizzle-orm/sqlite-core';

import { OrmConfiguration } from '../../../../configuration/BaseConfiguration';
import { OrmColumn } from '../../../decorators/OrmColumn';
import { OrmTable } from '../../../decorators/OrmTable';
import { OrmMutableBaseEntity } from '../../../entity/OrmMutableBaseEntity';
import { ormRequireTable } from '../../../metadata/OrmSchemaRegistry';
import { OrmSchemaBuilderDrizzleMySql } from '../../../schema/drizzle/OrmSchemaBuilderDrizzleMySql';
import { OrmSchemaBuilderDrizzleSQLite } from '../../../schema/drizzle/OrmSchemaBuilderDrizzleSQLite';
import { OrmDatabaseImpl } from '../../internal/OrmDatabaseImpl';
import { MySqlAdapter } from './mysql/MySqlAdapter';
import { BetterSQLiteAdapter } from './sqlite/BetterSQLiteAdapter';

// Audit finding 5: upsert of an existing row used to include createdAt
// in the conflict-update SET, resetting the stored creation time to now.
// OrmMutableBaseEntity provides id (uuid PK), createdAt, and updatedAt.
@OrmTable('upc_setting')
class UpcSetting extends OrmMutableBaseEntity {
    @OrmColumn({ kind: 'varchar', length: 64 })
    declare value: string;
}

function createSqliteDatabase(): {
    database: OrmDatabaseImpl;
    dispose: () => void;
} {
    const sqlite = new Database(':memory:');
    sqlite.exec(`
        CREATE TABLE upc_setting (
            id TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
        );
    `);

    const schema = new OrmSchemaBuilderDrizzleSQLite().createSchema([
        ormRequireTable(UpcSetting),
    ]);
    const adapter = new BetterSQLiteAdapter(
        sqlite,
        schema as Record<string, AnySQLiteTable>,
        { logging: false },
    );
    const configuration = {
        databaseName: '@default',
        entities: [UpcSetting],
        adapterType: 'drizzle',
        databaseType: { dialect: 'sqlite', driver: 'better-sqlite' },
    } as unknown as OrmConfiguration;
    return {
        database: new OrmDatabaseImpl(configuration, adapter),
        dispose: () => sqlite.close(),
    };
}

/**
 * A MySQL database that never connects: the proxy driver hands every statement to a callback, so
 * the SQL drizzle generates can be asserted on directly.
 *
 * Worth the extra scaffolding because the SQLite test below cannot see the MySQL bug at all — the
 * two adapters build their conflict-update SET independently, and only SQLite's routed through the
 * shared builder that filters create-date columns. A green suite on one dialect said nothing about
 * the other, which is exactly how `createdAt = VALUES(createdAt)` reached production.
 */
function createMySqlStatementRecorder(): {
    database: OrmDatabaseImpl;
    statements: string[];
} {
    const statements: string[] = [];
    const schema = new OrmSchemaBuilderDrizzleMySql().createSchema([
        ormRequireTable(UpcSetting),
    ]);
    // The proxy driver reads `insertId`/`affectedRows` off the result, so a bare `{ rows: [] }`
    // throws before the assertion runs. Shaped like a MySQL OkPacket instead.
    const db = drizzleMySqlProxy(
        async (sql: string) => {
            statements.push(sql);
            return { rows: [{ insertId: 0, affectedRows: 0 }] };
        },
        { schema },
    );
    const adapter = new MySqlAdapter(
        { dialect: 'mysql', driver: 'planetscale' } as never,
        db as never,
        schema as Record<string, AnyMySqlTable>,
        { logging: false },
    );
    const configuration = {
        databaseName: '@default',
        entities: [UpcSetting],
        adapterType: 'drizzle',
        databaseType: { dialect: 'mysql', driver: 'planetscale' },
    } as unknown as OrmConfiguration;
    return {
        database: new OrmDatabaseImpl(configuration, adapter),
        statements,
    };
}

describe('upsert preserves createdAt on existing rows', () => {
    it('does not write createdAt in the MySQL duplicate-key SET', async () => {
        const { database, statements } = createMySqlStatementRecorder();
        await database
            .getRepository(UpcSetting)
            .upsert(UpcSetting.from({ id: 's1', value: 'v1' }));

        const upsert = statements.find((statement) =>
            /on duplicate key update/i.test(statement),
        );
        expect(upsert).toBeDefined();
        // createdAt still belongs in the INSERT half — it is only the SET that must not touch it.
        expect(upsert).toMatch(/insert into[\s\S]*`createdAt`/i);
        const updateSet = upsert!.slice(
            upsert!.toLowerCase().indexOf('on duplicate key update'),
        );
        expect(updateSet).not.toMatch(/`createdAt`/i);
        expect(updateSet).toMatch(/`updatedAt`/i);
    });

    it('re-upserting a row keeps the original creation time and updates data', async () => {
        const { database, dispose } = createSqliteDatabase();
        try {
            const repo = database.getRepository(UpcSetting);
            const original = UpcSetting.from({ id: 's1', value: 'v1' });
            await repo.upsert(original);
            const stored = await repo.findOne({ where: { id: 's1' } });
            const originalCreatedAt = stored!.createdAt;

            // Simulate a later upsert of the same logical row.
            await new Promise((resolve) => setTimeout(resolve, 5));
            await repo.upsert(UpcSetting.from({ id: 's1', value: 'v2' }));

            const after = await repo.findOne({ where: { id: 's1' } });
            expect(after!.value).toBe('v2');
            expect(after!.createdAt).toEqual(originalCreatedAt);
        } finally {
            dispose();
        }
    });

    it('criteria-based update/upsert/increment bump updatedAt', async () => {
        // Audit finding 15: only the repository/entity path maintained
        // @OrmUpdateDateColumn — database-level criteria writes left
        // updatedAt stale, so updatedAt-keyed sync silently missed them.
        const { database, dispose } = createSqliteDatabase();
        try {
            const repo = database.getRepository(UpcSetting);
            await repo.insert(UpcSetting.from({ id: 's1', value: 'v1' }));
            const before = (await repo.findOne({ where: { id: 's1' } }))!
                .updatedAt;

            await new Promise((resolve) => setTimeout(resolve, 5));
            await database.update(UpcSetting, { id: 's1' }, { value: 'v2' });

            const after = (await repo.findOne({ where: { id: 's1' } }))!
                .updatedAt;
            expect(after.getTime()).toBeGreaterThan(before.getTime());
        } finally {
            dispose();
        }
    });
});
