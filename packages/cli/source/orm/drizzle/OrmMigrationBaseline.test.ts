// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
    buildMigrationBaselineSql,
    readMigrationBaselineEntries,
} from './OrmMigrationBaseline';

/**
 * Baseline SQL is what a user runs by hand against a production database
 * to adopt an existing schema — a wrong hash or timestamp silently makes
 * drizzle re-run (or skip) migrations. Pin both the journal resolution
 * and the emitted SQL for each dialect.
 */

function makeMigrations(
    folder: string,
    migrations: Array<{ tag: string; when: number; sql: string }>,
): void {
    fs.mkdirSync(path.join(folder, 'meta'), { recursive: true });
    fs.writeFileSync(
        path.join(folder, 'meta', '_journal.json'),
        JSON.stringify({
            version: '7',
            dialect: 'sqlite',
            entries: migrations.map((m, idx) => ({
                idx,
                version: '6',
                when: m.when,
                tag: m.tag,
                breakpoints: true,
            })),
        }),
    );
    for (const m of migrations) {
        fs.writeFileSync(path.join(folder, `${m.tag}.sql`), m.sql);
    }
}

function sha256(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
}

describe('readMigrationBaselineEntries', () => {
    let migrationsFolder: string;

    beforeEach(() => {
        migrationsFolder = fs.realpathSync(
            fs.mkdtempSync(path.join(os.tmpdir(), 'base-cli-baseline-')),
        );
    });

    afterEach(() => {
        fs.rmSync(migrationsFolder, { recursive: true, force: true });
    });

    it('resolves each journal entry to (tag, hash, when)', () => {
        makeMigrations(migrationsFolder, [
            {
                tag: '0000_first',
                when: 1760462949589,
                sql: 'CREATE TABLE `account` (`id` int);',
            },
            {
                tag: '0001_second',
                when: 1779998873852,
                sql: 'ALTER TABLE `account` ADD `email` text;',
            },
        ]);

        expect(readMigrationBaselineEntries(migrationsFolder)).toEqual([
            {
                tag: '0000_first',
                hash: sha256('CREATE TABLE `account` (`id` int);'),
                when: 1760462949589,
            },
            {
                tag: '0001_second',
                hash: sha256('ALTER TABLE `account` ADD `email` text;'),
                when: 1779998873852,
            },
        ]);
    });

    it('returns [] for an empty journal', () => {
        makeMigrations(migrationsFolder, []);
        expect(readMigrationBaselineEntries(migrationsFolder)).toEqual([]);
    });

    it('throws when the journal is missing', () => {
        expect(() => readMigrationBaselineEntries(migrationsFolder)).toThrow(
            /No migration journal found/,
        );
    });

    it('throws when a journal entry has no .sql file on disk', () => {
        makeMigrations(migrationsFolder, [
            { tag: '0000_first', when: 1, sql: 'CREATE TABLE `a` (`id` int);' },
        ]);
        fs.unlinkSync(path.join(migrationsFolder, '0000_first.sql'));
        expect(() => readMigrationBaselineEntries(migrationsFolder)).toThrow(
            /in the journal but missing on disk/,
        );
    });
});

describe('buildMigrationBaselineSql', () => {
    const entries = [
        { tag: '0000_first', hash: 'aaa111', when: 1760462949589 },
        { tag: '0001_second', hash: 'bbb222', when: 1779998873852 },
    ];

    it('emits the MySQL tracking table and one INSERT per migration', () => {
        const sql = buildMigrationBaselineSql(
            'mysql',
            '__drizzle_migrations_my_api',
            entries,
        );
        // DDL must match drizzle-orm's MySqlDialect.migrate verbatim in
        // structure (serial alias, text, bigint) so the table is identical
        // to one drizzle-kit would create.
        expect(sql).toContain(
            'CREATE TABLE IF NOT EXISTS `__drizzle_migrations_my_api` (\n' +
                '    id serial PRIMARY KEY,\n' +
                '    hash text NOT NULL,\n' +
                '    created_at bigint\n' +
                ');',
        );
        expect(sql).toContain(
            'INSERT INTO `__drizzle_migrations_my_api` (`hash`, `created_at`) ' +
                "VALUES ('aaa111', 1760462949589); -- 0000_first",
        );
        expect(sql).toContain(
            'INSERT INTO `__drizzle_migrations_my_api` (`hash`, `created_at`) ' +
                "VALUES ('bbb222', 1779998873852); -- 0001_second",
        );
    });

    it('emits the SQLite tracking table with drizzle-orm quoting and types', () => {
        const sql = buildMigrationBaselineSql(
            'sqlite',
            '__drizzle_migrations_my_api',
            entries,
        );
        // SQLite keeps drizzle-orm's literal DDL — including the inert
        // SERIAL column type — for structural parity with drizzle-kit.
        expect(sql).toContain(
            'CREATE TABLE IF NOT EXISTS "__drizzle_migrations_my_api" (\n' +
                '    id SERIAL PRIMARY KEY,\n' +
                '    hash text NOT NULL,\n' +
                '    created_at numeric\n' +
                ');',
        );
        expect(sql).toContain(
            'INSERT INTO "__drizzle_migrations_my_api" ("hash", "created_at") ' +
                "VALUES ('aaa111', 1760462949589); -- 0000_first",
        );
    });

    it('emits only the CREATE TABLE when there are no migrations', () => {
        const sql = buildMigrationBaselineSql(
            'mysql',
            '__drizzle_migrations_x',
            [],
        );
        expect(sql).toContain('CREATE TABLE IF NOT EXISTS');
        expect(sql).not.toContain('INSERT INTO');
    });
});
