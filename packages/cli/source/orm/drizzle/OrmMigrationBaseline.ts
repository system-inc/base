// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { OrmDatabaseDialect } from '@system-inc/base-foundation/orm/database/adapter/OrmDatabaseType';

/**
 * One journal entry resolved for baselining: the migration tag, the
 * sha256 of its `.sql` file (what drizzle-orm records when it applies a
 * migration), and the journal `when` timestamp (the only value drizzle
 * actually compares to decide whether a migration is applied).
 */
export interface OrmMigrationBaselineEntry {
    tag: string;
    hash: string;
    when: number;
}

/**
 * Reads a database's drizzle migration journal and resolves each entry
 * to the (tag, hash, when) triple drizzle-orm would record on apply.
 * The hash is sha256 over the raw `.sql` file bytes, matching
 * drizzle-orm's `readMigrationFiles`.
 */
export function readMigrationBaselineEntries(
    migrationsFolder: string,
): OrmMigrationBaselineEntry[] {
    const journalPath = path.join(migrationsFolder, 'meta', '_journal.json');
    if (!fs.existsSync(journalPath)) {
        throw new Error(
            `No migration journal found at ${journalPath}. ` +
                `Run \`base orm schema:generate\` to create migrations first.`,
        );
    }

    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as {
        entries?: Array<{ tag: string; when: number }>;
    };

    return (journal.entries ?? []).map((entry) => {
        const sqlPath = path.join(migrationsFolder, `${entry.tag}.sql`);
        if (!fs.existsSync(sqlPath)) {
            throw new Error(
                `Migration file ${sqlPath} is in the journal but missing on disk. ` +
                    `Run \`base orm migration:check\` for details.`,
            );
        }
        return {
            tag: entry.tag,
            hash: crypto
                .createHash('sha256')
                .update(fs.readFileSync(sqlPath))
                .digest('hex'),
            when: entry.when,
        };
    });
}

/**
 * Builds the SQL that creates the drizzle migration tracking table and
 * marks every given migration as applied — without running any of them.
 *
 * The DDL replicates what drizzle-orm's dialect `migrate()` executes
 * verbatim (including MySQL's `serial` alias and SQLite's inert `SERIAL`
 * column type), so a hand-baselined table is structurally identical to
 * one drizzle-kit created itself. Only the newest `created_at` affects
 * drizzle's applied-detection, but one row is emitted per migration so
 * the table reflects the full history.
 */
export function buildMigrationBaselineSql(
    dialect: Extract<OrmDatabaseDialect, 'mysql' | 'sqlite'>,
    tableName: string,
    entries: OrmMigrationBaselineEntry[],
): string {
    const quote = dialect === 'mysql' ? '`' : '"';
    const identifier = (name: string) => `${quote}${name}${quote}`;

    const createTable =
        dialect === 'mysql'
            ? `CREATE TABLE IF NOT EXISTS ${identifier(tableName)} (
    id serial PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
);`
            : `CREATE TABLE IF NOT EXISTS ${identifier(tableName)} (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at numeric
);`;

    const inserts = entries.map(
        (entry) =>
            `INSERT INTO ${identifier(tableName)} (${identifier('hash')}, ${identifier('created_at')}) ` +
            `VALUES ('${entry.hash}', ${entry.when}); -- ${entry.tag}`,
    );

    return [createTable, ...inserts].join('\n\n') + '\n';
}
