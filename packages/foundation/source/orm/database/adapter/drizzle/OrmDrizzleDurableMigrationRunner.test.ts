// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ormRunPendingMigrations } from './OrmDrizzleDurableMigrationRunner';

/**
 * Extracts comparable SQL text from drizzle's opaque sql template
 * object. `queryChunks` holds StringChunk ({ value: string[] }), Name
 * ({ value: string }), and raw parameter values — joining their text
 * reconstructs enough of the statement to dispatch on.
 */
function sqlText(q: unknown): string {
    const chunks = (q as { queryChunks?: unknown[] }).queryChunks;
    if (!Array.isArray(chunks)) {
        return String(q);
    }
    return chunks
        .map((chunk) => {
            const value = (chunk as { value?: unknown }).value;
            if (Array.isArray(value)) {
                return value.join('');
            }
            if (value !== undefined) {
                return String(value);
            }
            return String(chunk);
        })
        .join('');
}

/**
 * Builds a mock `db.values()` that returns different row shapes for
 * each SELECT the migration runner issues:
 *   - sqlite_master                        → [[tableName, sqlSchema]]
 *   - SELECT id, tag, createdAt … LIMIT 1  → last row (getLastMigration)
 *   - SELECT id, tag, createdAt FROM …     → all rows (getAppliedMigrationRows)
 *
 * Inspects the SQL chunk passed to `.values()` to dispatch.
 */
function makeMockValues({
    applied = [] as { tag: string; createdAt: number }[],
    lastTag,
    lastWhen,
}: {
    applied?: { tag: string; createdAt: number }[];
    lastTag?: string;
    lastWhen?: number;
}) {
    return (q: unknown) => {
        const text = sqlText(q);
        if (text.includes('sqlite_master')) {
            // Pretend the migrations table already exists with the
            // expected schema so createMigrationTable doesn't try to
            // recreate it.
            return [
                [
                    '__drizzle_migrations',
                    'CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, tag TEXT NOT NULL, createdAt INTEGER NOT NULL)',
                ],
            ];
        }
        if (/SELECT\s+id,\s*tag,\s*createdAt/i.test(text)) {
            if (/LIMIT\s+1/i.test(text)) {
                if (lastTag !== undefined && lastWhen !== undefined) {
                    return [[applied.length, lastTag, String(lastWhen)]];
                }
                return [];
            }
            return applied.map((row, index) => [
                index + 1,
                row.tag,
                String(row.createdAt),
            ]);
        }
        return [];
    };
}

describe('OrmDrizzleDurableMigrationRunner', () => {
    describe('runPendingMigrationsSequentially', () => {
        test('should run all migrations when starting fresh', async () => {
            // Mock database. Returns empty for every `values()` call —
            // table doesn't exist yet, no applied tags, no last
            // migration. Drift check sees nothing to drift.
            const mockDb = {
                run: jest.fn(),
                values: jest.fn(() => []),
                transaction: jest.fn((callback: (tx: unknown) => void) => {
                    const mockTx = { rollback: jest.fn() };
                    callback(mockTx);
                }),
            };

            // Mock DurableObjectState
            let blockConcurrencyCallCount = 0;
            const mockDurableState = {
                blockConcurrencyWhile: jest.fn(
                    async (callback: () => Promise<void>) => {
                        blockConcurrencyCallCount++;
                        await callback();
                    },
                ),
            } as unknown as DurableObjectState;

            // Mock migration config with 2 migrations
            const mockConfig = {
                journal: {
                    entries: [
                        {
                            idx: 0,
                            when: 1000,
                            tag: 'migration_0',
                            breakpoints: false,
                        },
                        {
                            idx: 1,
                            when: 2000,
                            tag: 'migration_1',
                            breakpoints: false,
                        },
                    ],
                },
                migrations: {
                    m0000: 'CREATE TABLE users (id text PRIMARY KEY);',
                    m0001: 'ALTER TABLE users ADD COLUMN name text;',
                },
            };

            await ormRunPendingMigrations(
                mockDurableState,
                mockDb as never,
                mockConfig,
            );

            // Should have called blockConcurrencyWhile 4 times:
            // 1. Create migration table
            // 2. Drift check (no drift detected, returns immediately)
            // 3. Run migration_0
            // 4. Run migration_1
            expect(blockConcurrencyCallCount).toBe(4);

            // Should have called db.run at least 5 times:
            // - CREATE migrations table (once)
            // - Migration 0 SQL statement
            // - INSERT migration 0 record
            // - Migration 1 SQL statement
            // - INSERT migration 1 record
            expect(mockDb.run).toHaveBeenCalled();
        });

        test('should not re-run completed migrations', async () => {
            // The runner issues several different SELECTs; the
            // returned row shape depends on which one. See
            // makeMockValues for the dispatch.
            const mockDb = {
                run: jest.fn(),
                values: jest.fn(
                    makeMockValues({
                        applied: [{ tag: 'migration_0', createdAt: 1000 }],
                        lastTag: 'migration_0',
                        lastWhen: 1000,
                    }),
                ),
                transaction: jest.fn((callback: (tx: unknown) => void) => {
                    const mockTx = { rollback: jest.fn() };
                    callback(mockTx);
                }),
            };

            // Mock DurableObjectState
            let blockConcurrencyCallCount = 0;
            const mockDurableState = {
                blockConcurrencyWhile: jest.fn(
                    async (callback: () => Promise<void>) => {
                        blockConcurrencyCallCount++;
                        await callback();
                    },
                ),
            } as unknown as DurableObjectState;

            // Mock migration config with 2 migrations
            const mockConfig = {
                journal: {
                    entries: [
                        {
                            idx: 0,
                            when: 1000,
                            tag: 'migration_0',
                            breakpoints: false,
                        },
                        {
                            idx: 1,
                            when: 2000,
                            tag: 'migration_1',
                            breakpoints: false,
                        },
                    ],
                },
                migrations: {
                    m0000: 'CREATE TABLE users (id text PRIMARY KEY);',
                    m0001: 'ALTER TABLE users ADD COLUMN name text;',
                },
            };

            await ormRunPendingMigrations(
                mockDurableState,
                mockDb as never,
                mockConfig,
            );

            // Should have called blockConcurrencyWhile 4 times:
            // 1. Create migration table
            // 2. Drift check (no drift — applied tag matches source)
            // 3. Check migration_0 (skipped, already complete)
            // 4. Run migration_1
            expect(blockConcurrencyCallCount).toBe(4);
        });

        test('should handle empty SQL statements gracefully', async () => {
            const mockDb = {
                run: jest.fn(),
                values: jest.fn(() => []),
                transaction: jest.fn((callback: (tx: unknown) => void) => {
                    const mockTx = { rollback: jest.fn() };
                    callback(mockTx);
                }),
            };

            const mockDurableState = {
                blockConcurrencyWhile: jest.fn(
                    async (callback: () => Promise<void>) => {
                        await callback();
                    },
                ),
            } as unknown as DurableObjectState;

            // Migration with empty statements and whitespace
            const mockConfig = {
                journal: {
                    entries: [
                        {
                            idx: 0,
                            when: 1000,
                            tag: 'migration_0',
                            breakpoints: false,
                        },
                    ],
                },
                migrations: {
                    m0000: '   --> statement-breakpoint  --> statement-breakpoint   ',
                },
            };

            // Should complete without throwing
            await expect(
                ormRunPendingMigrations(
                    mockDurableState,
                    mockDb as never,
                    mockConfig,
                ),
            ).resolves.not.toThrow();
        });

        test('should throw error on migration failure', async () => {
            const mockDb = {
                run: jest.fn(),
                values: jest.fn(() => []),
                transaction: jest.fn((callback: (tx: unknown) => void) => {
                    // Simulate a transaction error
                    const mockTx = { rollback: jest.fn() };
                    callback(mockTx);
                    // Throw error after transaction callback
                    mockTx.rollback();
                    throw new Error('SQL error: table does not exist');
                }),
            };

            const mockDurableState = {
                blockConcurrencyWhile: jest.fn(
                    async (callback: () => Promise<void>) => {
                        await callback();
                    },
                ),
            } as unknown as DurableObjectState;

            const mockConfig = {
                journal: {
                    entries: [
                        {
                            idx: 0,
                            when: 1000,
                            tag: 'migration_0',
                            breakpoints: false,
                        },
                    ],
                },
                migrations: {
                    m0000: 'ALTER TABLE nonexistent ADD COLUMN name text;',
                },
            };

            await expect(
                ormRunPendingMigrations(
                    mockDurableState,
                    mockDb as never,
                    mockConfig,
                ),
            ).rejects.toThrow('Migration migration_0 failed');
        });

        test('should handle no pending migrations', async () => {
            const mockDb = {
                run: jest.fn(),
                values: jest.fn(
                    makeMockValues({
                        applied: [
                            { tag: 'migration_0', createdAt: 1000 },
                            { tag: 'migration_1', createdAt: 2000 },
                        ],
                        lastTag: 'migration_1',
                        lastWhen: 2000,
                    }),
                ),
                transaction: jest.fn(),
            };

            const mockDurableState = {
                blockConcurrencyWhile: jest.fn(
                    async (callback: () => Promise<void>) => {
                        await callback();
                    },
                ),
            } as unknown as DurableObjectState;

            // All migrations are already completed
            const mockConfig = {
                journal: {
                    entries: [
                        {
                            idx: 0,
                            when: 1000,
                            tag: 'migration_0',
                            breakpoints: false,
                        },
                        {
                            idx: 1,
                            when: 2000,
                            tag: 'migration_1',
                            breakpoints: false,
                        },
                    ],
                },
                migrations: {
                    m0000: 'CREATE TABLE users (id text PRIMARY KEY);',
                    m0001: 'ALTER TABLE users ADD COLUMN name text;',
                },
            };

            await ormRunPendingMigrations(
                mockDurableState,
                mockDb as never,
                mockConfig,
            );

            // Should call blockConcurrencyWhile 4 times:
            // 1. Create migration table
            // 2. Drift check (no drift — applied tag matches source)
            // 3. Check migration_0 (skipped, already complete)
            // 4. Check migration_1 (skipped, already complete)
            expect(
                mockDurableState.blockConcurrencyWhile,
            ).toHaveBeenCalledTimes(4);
        });

        test('reconciles legacy placeholder tags instead of failing in production', async () => {
            // A real production upgrade scenario: migrations 0 and 1 were
            // applied under the legacy tracking schema, and the schema
            // upgrade re-labeled them 'migration_<createdAt>'. Their
            // createdAt still matches the journal `when`, so the runner
            // must rewrite the tags in place and boot — not throw.
            const mockDb = {
                run: jest.fn(),
                values: jest.fn(
                    makeMockValues({
                        applied: [
                            { tag: 'migration_1000', createdAt: 1000 },
                            { tag: 'migration_2000', createdAt: 2000 },
                        ],
                        lastTag: '0001_modern_hellfire_club',
                        lastWhen: 2000,
                    }),
                ),
                transaction: jest.fn((callback: (tx: unknown) => void) => {
                    const mockTx = { rollback: jest.fn() };
                    callback(mockTx);
                }),
            };

            const mockDurableState = {
                blockConcurrencyWhile: jest.fn(
                    async (callback: () => Promise<void>) => {
                        await callback();
                    },
                ),
            } as unknown as DurableObjectState;

            const mockConfig = {
                journal: {
                    entries: [
                        {
                            idx: 0,
                            when: 1000,
                            tag: '0000_lumpy_adam_destine',
                            breakpoints: false,
                        },
                        {
                            idx: 1,
                            when: 2000,
                            tag: '0001_modern_hellfire_club',
                            breakpoints: false,
                        },
                    ],
                },
                migrations: {
                    m0000: 'CREATE TABLE users (id text PRIMARY KEY);',
                    m0001: 'ALTER TABLE users ADD COLUMN name text;',
                },
            };

            // Default options = non-Development: previously threw
            // "Migration journal drift".
            await expect(
                ormRunPendingMigrations(
                    mockDurableState,
                    mockDb as never,
                    mockConfig,
                ),
            ).resolves.not.toThrow();

            // Both rows must have been rewritten to their journal tags.
            const updates = mockDb.run.mock.calls
                .map(([q]) => sqlText(q))
                .filter((text) => /UPDATE/i.test(text));
            expect(updates).toHaveLength(2);
        });

        test('reconciles hash-labeled legacy rows by createdAt match', async () => {
            // Older runners recorded drizzle's content hash where the
            // tag now lives — same reconciliation, keyed on createdAt.
            const mockDb = {
                run: jest.fn(),
                values: jest.fn(
                    makeMockValues({
                        applied: [{ tag: 'a3f9c0deadbeef', createdAt: 1000 }],
                        lastTag: 'migration_0',
                        lastWhen: 1000,
                    }),
                ),
                transaction: jest.fn((callback: (tx: unknown) => void) => {
                    const mockTx = { rollback: jest.fn() };
                    callback(mockTx);
                }),
            };

            const mockDurableState = {
                blockConcurrencyWhile: jest.fn(
                    async (callback: () => Promise<void>) => {
                        await callback();
                    },
                ),
            } as unknown as DurableObjectState;

            const mockConfig = {
                journal: {
                    entries: [
                        {
                            idx: 0,
                            when: 1000,
                            tag: 'migration_0',
                            breakpoints: false,
                        },
                    ],
                },
                migrations: {
                    m0000: 'CREATE TABLE users (id text PRIMARY KEY);',
                },
            };

            await expect(
                ormRunPendingMigrations(
                    mockDurableState,
                    mockDb as never,
                    mockConfig,
                ),
            ).resolves.not.toThrow();

            const updates = mockDb.run.mock.calls
                .map(([q]) => sqlText(q))
                .filter((text) => /UPDATE/i.test(text));
            expect(updates).toHaveLength(1);
        });

        test('still fails hard in production on genuine drift', async () => {
            // An applied tag with no journal match by tag OR createdAt
            // is real history rewriting — the hard error must remain.
            const mockDb = {
                run: jest.fn(),
                values: jest.fn(
                    makeMockValues({
                        applied: [{ tag: 'migration_999', createdAt: 999 }],
                    }),
                ),
                transaction: jest.fn(),
            };

            const mockDurableState = {
                blockConcurrencyWhile: jest.fn(
                    async (callback: () => Promise<void>) => {
                        await callback();
                    },
                ),
            } as unknown as DurableObjectState;

            const mockConfig = {
                journal: {
                    entries: [
                        {
                            idx: 0,
                            when: 1000,
                            tag: 'migration_0',
                            breakpoints: false,
                        },
                    ],
                },
                migrations: {
                    m0000: 'CREATE TABLE users (id text PRIMARY KEY);',
                },
            };

            await expect(
                ormRunPendingMigrations(
                    mockDurableState,
                    mockDb as never,
                    mockConfig,
                ),
            ).rejects.toThrow(/Migration journal drift/);

            // No reconciliation writes should have happened.
            const updates = mockDb.run.mock.calls
                .map(([q]) => sqlText(q))
                .filter((text) => /UPDATE/i.test(text));
            expect(updates).toHaveLength(0);
        });

        test('should parse statement-breakpoint correctly', async () => {
            const mockDb = {
                run: jest.fn(),
                values: jest.fn(() => []),
                transaction: jest.fn((callback: (tx: unknown) => void) => {
                    const mockTx = { rollback: jest.fn() };
                    callback(mockTx);
                }),
            };

            const mockDurableState = {
                blockConcurrencyWhile: jest.fn(
                    async (callback: () => Promise<void>) => {
                        await callback();
                    },
                ),
            } as unknown as DurableObjectState;

            // Migration with multiple statements
            const mockConfig = {
                journal: {
                    entries: [
                        {
                            idx: 0,
                            when: 1000,
                            tag: 'migration_0',
                            breakpoints: false,
                        },
                    ],
                },
                migrations: {
                    m0000: `CREATE TABLE users (id text PRIMARY KEY);--> statement-breakpoint
                    CREATE TABLE posts (id text PRIMARY KEY);--> statement-breakpoint
                    CREATE INDEX idx_user_id ON posts (id);`,
                },
            };

            await ormRunPendingMigrations(
                mockDurableState,
                mockDb as never,
                mockConfig,
            );

            // Should have called db.run 5 times:
            // - 1 CREATE TABLE __drizzle_migrations
            // - 3 SQL statements from the migration
            // - 1 INSERT to record migration completion
            expect(mockDb.run).toHaveBeenCalledTimes(5);
        });
    });
});
