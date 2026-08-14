// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { AnySQLiteTable } from 'drizzle-orm/sqlite-core';

import { OrmBatchOperation } from '../../../../interfaces/OrmBatchOperation';
import { OrmBatchResult } from '../../../../interfaces/result/OrmBatchResult';
import { OrmDeleteResult } from '../../../../interfaces/result/OrmDeleteResult';
import { OrmInsertResult } from '../../../../interfaces/result/OrmInsertResult';
import { OrmUpdateResult } from '../../../../interfaces/result/OrmUpdateResult';
import { OrmDatabaseImpl } from '../../../internal/OrmDatabaseImpl';
import { OrmTransactionImpl } from '../../../internal/OrmTransactionImpl';
import { OrmTransaction } from '../../../transaction/OrmTransaction';
import {
    OrmAdapterOptions,
    ormIsAdapterOptions,
} from '../../OrmAdapterOptions';
import { DrizzleFullSchema } from '../types/DrizzleDefaultSchema';
import { SQLiteAdapter, SQLiteTx } from './SQLiteAdapter';

export class BetterSQLiteAdapter extends SQLiteAdapter {
    private readonly sqliteDb: Database.Database;
    private readonly options: OrmAdapterOptions;

    constructor(
        sqliteDb: Database.Database,
        schema: DrizzleFullSchema<AnySQLiteTable>,
        options: OrmAdapterOptions,
    );
    constructor(
        sqliteDb: Database.Database,
        schema: DrizzleFullSchema<AnySQLiteTable>,
        tx: SQLiteTx,
        options: OrmAdapterOptions,
    );
    constructor(
        sqliteDb: Database.Database,
        schema: DrizzleFullSchema<AnySQLiteTable>,
        txOrOptions: SQLiteTx | OrmAdapterOptions,
        options?: OrmAdapterOptions,
    ) {
        const db = ormIsAdapterOptions(txOrOptions)
            ? drizzle(sqliteDb, { schema, logger: txOrOptions.logging })
            : txOrOptions;
        super({ dialect: 'sqlite', driver: 'better-sqlite' }, db, schema);
        this.sqliteDb = sqliteDb;
        this.options = ormIsAdapterOptions(txOrOptions)
            ? txOrOptions
            : options || {};
    }

    override async dispose(): Promise<void> {
        this.sqliteDb.close();
    }

    override async transaction<T>(
        context: OrmDatabaseImpl,
        callback: (tx: OrmTransaction) => Promise<T>,
    ): Promise<T> {
        let txContext: OrmTransactionImpl | undefined;
        // SQLite transactions are synchronous, but we wrap in async for consistency
        try {
            const txResult = await this.db.transaction((tx) => {
                txContext = new OrmTransactionImpl(
                    context.configuration,
                    new BetterSQLiteAdapter(
                        this.sqliteDb,
                        this.schema,
                        tx,
                        this.options,
                    ),
                );
                return callback(txContext);
            });
            await txContext?.runOnSuccess();
            return txResult;
        } catch (error) {
            await txContext?.runOnFailure();
            throw error;
        }
    }

    /**
     * better-sqlite3's `.transaction()` is synchronous and (since v12) throws if
     * the callback returns a promise, so the inherited async `writeBatch`
     * (DrizzleAdapterBase) hits that guard. Run the batch synchronously inside
     * the transaction instead: drizzle's better-sqlite3 session runs the callback
     * synchronously and returns its value directly. This is also strictly MORE
     * correct than the async path was here — an async callback resolved to a
     * promise that committed at the first await, so the batch ran auto-committed
     * outside any transaction (silently non-atomic). Production drivers are
     * unaffected: PlanetScale keeps the async base path (its session awaits), and
     * D1 / Durable Objects override writeBatch entirely.
     */
    override async writeBatch(
        operations: ReadonlyArray<OrmBatchOperation>,
    ): Promise<OrmBatchResult> {
        if (operations.length === 0) {
            return { affectedRows: 0, results: [] };
        }
        return this.db.transaction((tx: SQLiteTx) =>
            this.executeBatchOperationsSync(tx, operations),
        );
    }

    /**
     * Convert driver-specific insert result to ORM insert result
     * Override this method in subclasses to handle driver-specific result formats
     */
    protected override convertInsertResult<EntityType extends object>(
        driverResult: Database.RunResult,
    ): OrmInsertResult<EntityType> {
        return {
            affectedRows: driverResult.changes,
            raw: driverResult,
            insertedId: driverResult.lastInsertRowid,
        };
    }

    /**
     * Convert driver-specific update result to ORM update result
     * Override this method in subclasses to handle driver-specific result formats
     */
    protected override convertUpdateResult<EntityType extends object>(
        driverResults: Database.RunResult[],
    ): OrmUpdateResult<EntityType> {
        let totalAffectedRows = 0;
        for (const result of driverResults) {
            totalAffectedRows += result.changes;
        }

        return {
            affectedRows: totalAffectedRows,
            raw: driverResults,
        };
    }

    /**
     * Convert driver-specific upsert result to ORM insert result
     * Override this method in subclasses to handle driver-specific result formats
     */
    protected override convertUpsertResult<EntityType extends object>(
        driverResults: Database.RunResult[],
    ): OrmInsertResult<EntityType> {
        let totalAffectedRows = 0;
        for (const result of driverResults) {
            totalAffectedRows += result.changes;
        }

        return {
            affectedRows: totalAffectedRows,
            raw: driverResults,
        };
    }

    /**
     * Convert driver-specific delete result to ORM delete result
     * Override this method in subclasses to handle driver-specific result formats
     */
    protected override convertDeleteResult<EntityType extends object>(
        driverResult: Database.RunResult,
    ): OrmDeleteResult<EntityType> {
        return {
            affectedRows: driverResult.changes,
            raw: driverResult,
        };
    }
}
