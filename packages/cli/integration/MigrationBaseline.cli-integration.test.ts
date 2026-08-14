// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as path from 'path';

import { PROJECT_ROOT, runBase } from './internal/RunBase';

/**
 * End-to-end coverage for `base orm migration:baseline`. The SQL-building
 * logic is unit-tested (OrmMigrationBaseline.test.ts); these pin the full
 * command path — settings load, dialect resolution, per-worker table
 * naming, journal discovery — against the real example workers, and the
 * documented rejection of Durable Object databases.
 */

const LONG_TIMEOUT = 60_000;

function readJournalTags(worker: string, database: string): string[] {
    const journalPath = path.join(
        PROJECT_ROOT,
        'examples',
        worker,
        'database',
        database,
        'drizzle',
        'migrations',
        'meta',
        '_journal.json',
    );
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as {
        entries: Array<{ tag: string }>;
    };
    return journal.entries.map((e) => e.tag);
}

describe('base orm migration:baseline', () => {
    it(
        'emits MySQL baseline SQL for the default (PlanetScale) database',
        () => {
            const result = runBase(
                ['orm', 'migration:baseline', 'test-worker'],
                { cwd: PROJECT_ROOT, timeoutMs: LONG_TIMEOUT },
            );

            expect(result.code).toBe(0);
            expect(result.stdout).toContain(
                'CREATE TABLE IF NOT EXISTS `__drizzle_migrations_test_worker`',
            );
            expect(result.stdout).toContain('created_at bigint');

            // One INSERT per journal entry, each carrying a sha256 hash.
            for (const tag of readJournalTags('test-worker', '@default')) {
                expect(result.stdout).toMatch(
                    new RegExp(
                        'INSERT INTO `__drizzle_migrations_test_worker` ' +
                            "\\(`hash`, `created_at`\\) VALUES \\('[0-9a-f]{64}', \\d+\\); -- " +
                            tag,
                    ),
                );
            }
        },
        LONG_TIMEOUT,
    );

    it(
        'emits SQLite baseline SQL for a D1 database (--database d1)',
        () => {
            const result = runBase(
                [
                    'orm',
                    'migration:baseline',
                    'test-worker',
                    '--database',
                    'd1',
                ],
                { cwd: PROJECT_ROOT, timeoutMs: LONG_TIMEOUT },
            );

            expect(result.code).toBe(0);
            expect(result.stdout).toContain(
                'CREATE TABLE IF NOT EXISTS "__drizzle_migrations_test_worker"',
            );
            expect(result.stdout).toContain('created_at numeric');
            for (const tag of readJournalTags('test-worker', 'd1')) {
                expect(result.stdout).toContain(`; -- ${tag}`);
            }
        },
        LONG_TIMEOUT,
    );

    it(
        'rejects Durable Object SQLite databases (tracking lives inside the DO)',
        () => {
            const result = runBase(
                ['orm', 'migration:baseline', 'base-durable'],
                { cwd: PROJECT_ROOT, timeoutMs: LONG_TIMEOUT },
            );

            expect(result.code).not.toBe(0);
            expect(result.stderr + result.stdout).toMatch(
                /Durable Object SQLite databases cannot be baselined/,
            );
        },
        LONG_TIMEOUT,
    );
});
