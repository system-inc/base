// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { drizzle } from 'drizzle-orm/durable-sqlite';
import type { AnySQLiteTable } from 'drizzle-orm/sqlite-core';

import { OrmBatchOperation } from '../../../../interfaces/OrmBatchOperation';
import { OrmBatchResult } from '../../../../interfaces/result/OrmBatchResult';
import { OrmDeleteResult } from '../../../../interfaces/result/OrmDeleteResult';
import { OrmInsertResult } from '../../../../interfaces/result/OrmInsertResult';
import { OrmUpdateResult } from '../../../../interfaces/result/OrmUpdateResult';
import { OrmDatabaseImpl } from '../../../internal/OrmDatabaseImpl';
import { OrmTransactionImpl } from '../../../internal/OrmTransactionImpl';
import { OrmTransaction } from '../../../transaction/OrmTransaction';
import { OrmAdapterOptions } from '../../OrmAdapterOptions';
import { OrmDurableAdapter } from '../../OrmDurableAdapter';
import { ormRunPendingMigrations } from '../OrmDrizzleDurableMigrationRunner';
import { DrizzleFullSchema } from '../types/DrizzleDefaultSchema';
import {
    DrizzleMigrationConfig,
    DrizzleMigrationEntry,
} from '../types/DrizzleMigrationConfig';
import { SQLiteAdapter, SQLiteDb, SQLiteTx } from './SQLiteAdapter';

export class DurableAdapter extends SQLiteAdapter implements OrmDurableAdapter {
    // Durable Objects SQLite has a limit of 100 bound parameters per query
    protected readonly maxSQLVariables: number = 100;

    constructor(
        private readonly durableState: DurableObjectState,
        schema: DrizzleFullSchema<AnySQLiteTable>,
        private readonly options: OrmAdapterOptions,
        private readonly migrations: DrizzleMigrationConfig,
        // Tag list from release.ts. Used in non-Development envs as a
        // defense-in-depth check (refuse to run unreleased migrations
        // even if `base deploy`'s pre-flight check was bypassed).
        private readonly released: string[],
        // Whether the worker is running in Development. In Dev we
        // tolerate (and auto-recover from) journal drift caused by
        // schema:diff's auto-fold rewriting unreleased migrations.
        // In non-Dev, drift is a hard error.
        private readonly isDevelopment: boolean,
    ) {
        const db = isDurableObjectStorage(durableState.storage)
            ? drizzle(durableState.storage, {
                  schema,
                  logger: options.logging,
              })
            : durableState.storage;

        super({ dialect: 'sqlite', driver: 'durable' }, db, schema);
    }

    override async transaction<T>(
        context: OrmDatabaseImpl,
        callback: (tx: OrmTransaction) => Promise<T>,
    ): Promise<T> {
        let txContext: OrmTransactionImpl | undefined;
        try {
            // `_tx` is the legacy KV transaction handle — ignored. DO storage
            // is a single SQLite engine (KV is just a table), so SQL issued
            // through the existing `this.db` inside `storage.transaction(...)`
            // is already atomic; no separate tx-scoped db handle exists.
            const txResult = await this.durableState.storage.transaction(
                async (_tx) => {
                    txContext = new OrmTransactionImpl(
                        context.configuration,
                        this,
                    );
                    return await callback(txContext);
                },
            );
            await txContext?.runOnSuccess();
            return txResult;
        } catch (error) {
            await txContext?.runOnFailure();
            throw error;
        }
    }

    /**
     * The inherited `writeBatch` wraps the operations in Drizzle's
     * `db.transaction`, which the durable-sqlite driver implements via
     * workerd's SYNCHRONOUS `transactionSync` — an async callback escapes
     * it at its first await, the empty transaction commits immediately,
     * and every batched statement then runs auto-committed outside any
     * transaction (op N failing leaves ops 1..N-1 applied). Wrap the
     * batch in the async-safe `storage.transaction` instead — the same
     * rationale as the `transaction()` override above: DO storage is one
     * SQLite engine, so SQL issued through `this.db` inside it is atomic.
     */
    override async writeBatch(
        operations: ReadonlyArray<OrmBatchOperation>,
    ): Promise<OrmBatchResult> {
        if (operations.length === 0) {
            return { affectedRows: 0, results: [] };
        }
        return await this.durableState.storage.transaction(async () => {
            return await this.executeBatchOperations(this.db, operations);
        });
    }

    // Drizzle DO's prepared-query `run()` discards `sql.exec(...)`'s return
    // value, so `driverResult` reaches us as `undefined`. DO's SqlStorage
    // cursor exposes `rowsWritten`, but we never see the cursor through
    // Drizzle — so `affectedRows`/`insertedId` are unavailable here without
    // bypassing the Drizzle pipeline. Callers on Durable that need write
    // counts should query the data back instead.

    protected convertInsertResult<EntityType extends object>(
        _driverResult: unknown,
    ): OrmInsertResult<EntityType> {
        return {
            raw: null,
        };
    }

    protected convertUpdateResult<EntityType extends object>(
        _driverResults: unknown[],
    ): OrmUpdateResult<EntityType> {
        return {
            raw: null,
        };
    }

    protected convertUpsertResult<EntityType extends object>(
        _driverResults: unknown[],
    ): OrmInsertResult<EntityType> {
        return {
            raw: null,
        };
    }

    protected convertDeleteResult<EntityType extends object>(
        _driverResult: unknown,
    ): OrmDeleteResult<EntityType> {
        return {
            raw: null,
        };
    }

    async migrate(): Promise<void> {
        // Defense-in-depth: in non-Development environments, refuse to
        // apply any migration whose tag isn't in the released list.
        // The primary gate is `base deploy`'s pre-flight check; this is
        // the safety net for deploys that bypass it (raw wrangler, etc.).
        if (!this.isDevelopment) {
            const releasedSet = new Set(this.released);
            const unreleased = this.migrations.journal.entries
                .map((e) => e.tag)
                .filter((tag) => !releasedSet.has(tag));
            if (unreleased.length > 0) {
                throw new Error(
                    `Refusing to apply unreleased migration(s) on non-Development environment: ${unreleased.join(', ')}. ` +
                        `Run \`base orm migrations:release\` and redeploy.`,
                );
            }
        }

        // Run migrations with proper concurrency control
        // Each migration gets its own blockConcurrencyWhile for:
        // 1. Independent 30-second timeout budgets (no cumulative timeout risk)
        // 2. Race condition protection (only one request can run a specific migration at a time)
        await ormRunPendingMigrations(
            this.durableState,
            this.db as SQLiteDb<'sync'>,
            this.migrations,
            '__drizzle_migrations',
            { isDevelopment: this.isDevelopment },
        );
    }

    getAvailableMigrations(): Array<DrizzleMigrationEntry> {
        return this.migrations.journal.entries;
    }

    getReleased(): readonly string[] {
        return this.released;
    }
}

export function isDurableObjectStorage(
    storage: DurableObjectStorage | SQLiteTx,
): storage is DurableObjectStorage {
    return (storage as DurableObjectStorage).transactionSync !== undefined;
}
