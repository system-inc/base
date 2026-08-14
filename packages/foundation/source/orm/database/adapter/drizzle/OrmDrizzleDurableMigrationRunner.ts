// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { sql } from 'drizzle-orm';
import type { DrizzleSqliteDODatabase } from 'drizzle-orm/durable-sqlite';

import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { DrizzleMigrationConfig } from './types/DrizzleMigrationConfig';

interface MigrationMeta {
    sql: string[];
    breakpoints: boolean;
    createdAt: number;
    tag: string;
    idx: number;
}

/**
 * Reads and parses migration files from the config
 * (Adapted from Drizzle's readMigrationFiles)
 */
function readMigrationFiles(config: DrizzleMigrationConfig): MigrationMeta[] {
    const migrationQueries: MigrationMeta[] = [];

    for (const journalEntry of config.journal.entries) {
        const query =
            config.migrations[
                `m${journalEntry.idx.toString().padStart(4, '0')}`
            ];

        if (!query) {
            throw new Error(`Missing migration: ${journalEntry.tag}`);
        }

        try {
            const result = query
                .split('--> statement-breakpoint')
                .map((it) => {
                    return it.trim();
                })
                .filter((it) => it.length > 0);

            migrationQueries.push({
                sql: result,
                breakpoints: journalEntry.breakpoints,
                createdAt: journalEntry.when,
                tag: journalEntry.tag,
                idx: journalEntry.idx,
            });
        } catch {
            throw new Error(`Failed to parse migration: ${journalEntry.tag}`);
        }
    }

    return migrationQueries;
}

/**
 * Creates the migrations tracking table if it doesn't exist, or fixes the old schema
 */
function createMigrationTable<TSchema extends Record<string, unknown>>(
    db: DrizzleSqliteDODatabase<TSchema>,
    migrationsTable: string,
): void {
    // Check if table exists and get its schema
    const tableInfo = db.values<[string, string]>(
        sql`SELECT name, sql FROM sqlite_master WHERE type='table' AND name = ${migrationsTable}`,
    );

    if (tableInfo.length === 0) {
        // Table doesn't exist, create with correct schema
        const migrationTableCreate = sql`
            CREATE TABLE ${sql.identifier(migrationsTable)} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tag TEXT NOT NULL,
                createdAt INTEGER NOT NULL
            )
        `;
        db.run(migrationTableCreate);
        Logger.info(LogCategory.Orm, 
            'Created migrations table: %s with correct schema',
            migrationsTable,
        );
    } else {
        // Table exists, check if it has broken SERIAL syntax
        const tableSql = tableInfo[0][1];
        const hasBrokenPrimaryKey = tableSql.includes('SERIAL');

        if (hasBrokenPrimaryKey) {
            Logger.info(LogCategory.Orm, 
                'Migrating %s to fix broken PRIMARY KEY syntax...',
                migrationsTable,
            );

            // Migrate from broken schema to correct schema in a transaction
            db.transaction((tx) => {
                try {
                    const tempTable = `${migrationsTable}_new`;

                    // Create new table with correct schema
                    db.run(sql`
                        CREATE TABLE ${sql.identifier(tempTable)} (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            tag TEXT NOT NULL,
                            createdAt INTEGER NOT NULL
                        )
                    `);

                    // Copy existing data, generating placeholder tags for old empty records
                    // Old schema uses 'hash' column and 'created_at' (snake_case)
                    db.run(sql`
                        INSERT INTO ${sql.identifier(tempTable)} (id, tag, createdAt)
                        SELECT id,
                               CASE
                                   WHEN hash = '' OR hash IS NULL
                                   THEN 'migration_' || CAST(created_at AS TEXT)
                                   ELSE hash
                               END,
                               created_at
                        FROM ${sql.identifier(migrationsTable)}
                    `);

                    // Drop old table
                    db.run(sql`DROP TABLE ${sql.identifier(migrationsTable)}`);

                    // Rename new table to original name
                    db.run(
                        sql`ALTER TABLE ${sql.identifier(tempTable)} RENAME TO ${sql.identifier(migrationsTable)}`,
                    );

                    Logger.info(LogCategory.Orm, 
                        'Successfully migrated %s to correct schema',
                        migrationsTable,
                    );
                } catch (error: unknown) {
                    tx.rollback();
                    throw error;
                }
            });
        }
    }
}

/**
 * Gets the last completed migration from the database
 */
function getLastMigration<TSchema extends Record<string, unknown>>(
    db: DrizzleSqliteDODatabase<TSchema>,
    migrationsTable: string,
): [number, string, number] | undefined {
    const dbMigrations = db.values<[number, string, number]>(
        sql`SELECT id, tag, createdAt FROM ${sql.identifier(migrationsTable)} ORDER BY createdAt DESC LIMIT 1`,
    );
    return dbMigrations[0] ?? undefined;
}

interface AppliedMigrationRow {
    id: number;
    tag: string;
    createdAt: number;
}

/**
 * Returns every migration row recorded as applied in the DO's
 * migrations table. Used to detect — and reconcile — drift between
 * applied state and what the source journal currently lists.
 */
function getAppliedMigrationRows<TSchema extends Record<string, unknown>>(
    db: DrizzleSqliteDODatabase<TSchema>,
    migrationsTable: string,
): AppliedMigrationRow[] {
    const rows = db.values<[number, string, number]>(
        sql`SELECT id, tag, createdAt FROM ${sql.identifier(migrationsTable)}`,
    );
    return rows.map(([id, tag, createdAt]) => ({
        id,
        tag,
        createdAt: Number(createdAt),
    }));
}

/**
 * Drop every user table in the DO's SQLite plus the migrations
 * tracking table. The migration runner then recreates the tracking
 * table and reapplies the full source journal on the next pass.
 *
 * Development-only. The wipe is destructive; it's safe in dev because
 * DO state there is throwaway (each test/iteration starts fresh
 * anyway). In production this would be data loss.
 */
function wipeUserTablesAndMigrationsState<
    TSchema extends Record<string, unknown>,
>(db: DrizzleSqliteDODatabase<TSchema>, migrationsTable: string): void {
    // Find every table in the DB except sqlite's own internals.
    const tables = db.values<[string]>(
        sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
    );

    db.transaction((tx) => {
        try {
            for (const [tableName] of tables) {
                tx.run(sql`DROP TABLE IF EXISTS ${sql.identifier(tableName)}`);
            }
        } catch (error: unknown) {
            tx.rollback();
            throw error;
        }
    });

    // Recreate the tracking table so the rest of the migration flow
    // can proceed against a clean slate.
    createMigrationTable(db, migrationsTable);
}

/**
 * Records a migration as complete in the tracking table
 */
function recordMigrationComplete<TSchema extends Record<string, unknown>>(
    db: DrizzleSqliteDODatabase<TSchema>,
    migration: MigrationMeta,
    migrationsTable: string,
): void {
    db.run(
        sql`INSERT INTO ${sql.identifier(migrationsTable)} ("tag", "createdAt") VALUES(${migration.tag}, ${migration.createdAt})`,
    );
}

/**
 * Runs a single migration's SQL statements in a transaction
 */
function runSingleMigration<TSchema extends Record<string, unknown>>(
    db: DrizzleSqliteDODatabase<TSchema>,
    migration: MigrationMeta,
    migrationsTable: string,
): void {
    db.transaction((tx) => {
        try {
            // Execute each SQL statement in the migration
            for (const stmt of migration.sql) {
                if (stmt.trim().length > 0) {
                    db.run(sql.raw(stmt));
                }
            }

            // Record the migration as complete
            recordMigrationComplete(db, migration, migrationsTable);
        } catch (error: unknown) {
            // Rollback on any error
            tx.rollback();
            throw error;
        }
    });
}

/**
 * Migration runner for Durable SQLite databases.
 *
 * Runs all pending migrations sequentially, with each migration
 * getting its own blockConcurrencyWhile call for race condition protection and
 * independent 30-second timeout budgets. Errors are fail-fast with automatic
 * retry on next access.
 *
 * Before judging drift, applied rows carrying an obsolete label — the
 * placeholder tags the tracking-table schema upgrade synthesizes, or a
 * content hash an older runner recorded — are reconciled back to their
 * journal tag by exact `createdAt` match and rewritten in place, so a
 * DO that lived through the legacy schema keeps booting in every
 * environment.
 *
 * In Development, detects "journal drift" — applied migration tags that
 * no longer exist in source (which happens after `schema:diff` auto-folds
 * an unreleased migration). When drift is detected, wipes the DO's user
 * tables and the migrations tracking table, then reapplies from scratch.
 * This makes iteration on a single growing unreleased migration seamless
 * — local DOs don't accumulate stale schema.
 *
 * In non-Development, the same drift situation is a hard error (this
 * function only sees the situation after the caller's released-list
 * check passes, so drift in prod is an integrity bug).
 */
export async function ormRunPendingMigrations<
    TSchema extends Record<string, unknown>,
>(
    durableState: DurableObjectState,
    db: DrizzleSqliteDODatabase<TSchema>,
    config: DrizzleMigrationConfig,
    migrationsTable: string = '__drizzle_migrations',
    options: { isDevelopment?: boolean } = {},
): Promise<void> {
    // Parse all migrations from the config (non-DB operation, safe outside blockConcurrencyWhile)
    const allMigrations = readMigrationFiles(config);

    // Create the migration tracking table once before running migrations
    // This prevents race conditions and avoids redundant CREATE TABLE calls
    await durableState.blockConcurrencyWhile(async () => {
        createMigrationTable(db, migrationsTable);
    });

    // Drift check: tags in the DB's migrations table that no longer
    // appear in the source's journal. Caused by auto-fold rewriting
    // an unreleased migration to a new tag — or, benignly, by legacy
    // rows re-labeled during the tracking-table schema upgrade.
    await durableState.blockConcurrencyWhile(async () => {
        const sourceTags = new Set(allMigrations.map((m) => m.tag));
        const sourceTagByCreatedAt = new Map(
            allMigrations.map((m) => [m.createdAt, m.tag]),
        );
        const appliedRows = getAppliedMigrationRows(db, migrationsTable);

        // Reconcile legacy labels before judging drift. The schema
        // upgrade in createMigrationTable synthesizes placeholder tags
        // ('migration_<createdAt>') for pre-tag rows, and older runners
        // recorded drizzle's content hash where the tag now lives. In
        // both cases the row's createdAt is the journal entry's `when`
        // — a millisecond generation stamp, unique per migration — so
        // an applied row whose createdAt exactly matches a journal
        // entry IS that migration under an obsolete label. Rewrite the
        // row to the journal tag instead of treating it as drift.
        for (const row of appliedRows) {
            if (sourceTags.has(row.tag)) {
                continue;
            }
            const journalTag = sourceTagByCreatedAt.get(row.createdAt);
            if (journalTag !== undefined) {
                Logger.info(LogCategory.Orm, 
                    "Reconciling legacy migration tag '%s' -> '%s' (createdAt %d).",
                    row.tag,
                    journalTag,
                    row.createdAt,
                );
                db.run(
                    sql`UPDATE ${sql.identifier(migrationsTable)} SET tag = ${journalTag} WHERE id = ${row.id}`,
                );
                row.tag = journalTag;
            }
        }

        const driftedTags = appliedRows
            .map((row) => row.tag)
            .filter((tag) => !sourceTags.has(tag));

        if (driftedTags.length === 0) return;

        if (!options.isDevelopment) {
            throw new Error(
                `Migration journal drift in non-Development environment. ` +
                    `Applied tag(s) no longer present in source: ${driftedTags.join(', ')}. ` +
                    `This shouldn't happen — released migrations are append-only. ` +
                    `Investigate before retrying.`,
            );
        }

        // Dev: wipe and re-apply.
        Logger.warn(LogCategory.Orm, 
            'Detected %d drifted migration(s) [%s]. Wiping DO schema and reapplying from source (Development env).',
            driftedTags.length,
            driftedTags.join(', '),
        );
        wipeUserTablesAndMigrationsState(db, migrationsTable);
    });

    // Track how many migrations we actually run
    let migrationsRun = 0;

    // Run each migration in its own blockConcurrencyWhile call
    // This gives each migration its own 30-second budget and prevents race conditions
    for (const migration of allMigrations) {
        await durableState.blockConcurrencyWhile(async () => {
            // Check if this specific migration has already been run
            const lastMigration = getLastMigration(db, migrationsTable);
            const isMigrationPending =
                !lastMigration ||
                migration.createdAt > Number(lastMigration[2]);

            if (!isMigrationPending) {
                // Migration already completed by this or another request, skip it
                return;
            }

            // Log on first migration
            if (migrationsRun === 0) {
                Logger.info(LogCategory.Orm, 'Running pending migrations...');
            }

            Logger.info(LogCategory.Orm, 
                'Running migration: %s (%d)',
                migration.tag,
                migration.idx,
            );

            try {
                runSingleMigration(db, migration, migrationsTable);
                migrationsRun++;
                Logger.info(LogCategory.Orm, 
                    'Migration %s completed successfully',
                    migration.tag,
                );
            } catch (error: unknown) {
                Logger.error(LogCategory.Orm, 'Migration %s failed:', migration.tag, error);
                // Fail-fast: throw immediately so the request fails
                // Next access will retry from this migration
                const errorMessage =
                    error instanceof Error ? error.message : String(error);
                throw new Error(
                    `Migration ${migration.tag} failed: ${errorMessage}. This migration will retry on next access.`,
                );
            }
        });
    }

    if (migrationsRun === 0) {
        Logger.debug(LogCategory.Orm, 'No pending migrations to run.');
    } else {
        Logger.info(LogCategory.Orm, 
            'All %d migration(s) completed successfully',
            migrationsRun,
        );
    }
}
