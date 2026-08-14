// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
import { drizzle } from 'drizzle-orm/d1';
import { AnySQLiteTable } from 'drizzle-orm/sqlite-core';

import { OrmBatchOperation } from '../../../../interfaces/OrmBatchOperation';
import { OrmBatchResult } from '../../../../interfaces/result/OrmBatchResult';
import { OrmDeleteResult } from '../../../../interfaces/result/OrmDeleteResult';
import { OrmInsertResult } from '../../../../interfaces/result/OrmInsertResult';
import { OrmUpdateResult } from '../../../../interfaces/result/OrmUpdateResult';
import { OrmDatabaseImpl } from '../../../internal/OrmDatabaseImpl';
import { OrmTransaction } from '../../../transaction/OrmTransaction';
import {
    OrmAdapterOptions,
    ormIsAdapterOptions,
} from '../../OrmAdapterOptions';
import { DrizzleFullSchema } from '../types/DrizzleDefaultSchema';
import { SQLiteAdapter, SQLiteTx } from './SQLiteAdapter';

export class D1Adapter extends SQLiteAdapter {
    // D1 doesn't support explicit transactions — use writeBatch for atomic writes.
    override readonly supportsInteractiveTransactions = false;

    // D1 also has a limit of 100 bound parameters per query
    protected readonly maxSQLVariables: number = 100;

    private readonly d1: D1Database;
    private readonly options: OrmAdapterOptions;

    constructor(
        d1: D1Database,
        schema: DrizzleFullSchema<AnySQLiteTable>,
        options: OrmAdapterOptions,
    );
    constructor(
        d1: D1Database,
        schema: DrizzleFullSchema<AnySQLiteTable>,
        tx: SQLiteTx,
        options: OrmAdapterOptions,
    );
    constructor(
        d1: D1Database,
        schema: DrizzleFullSchema<AnySQLiteTable>,
        txOrOptions: SQLiteTx | OrmAdapterOptions,
        options?: OrmAdapterOptions,
    ) {
        const db = ormIsAdapterOptions(txOrOptions)
            ? drizzle(d1, {
                  schema,
                  logger: txOrOptions.logging,
              })
            : txOrOptions;
        super({ dialect: 'sqlite', driver: 'd1' }, db, schema);
        this.d1 = d1;
        this.options = ormIsAdapterOptions(txOrOptions)
            ? txOrOptions
            : options || {};
    }

    override async transaction<T>(
        _context: OrmDatabaseImpl,
        _callback: (tx: OrmTransaction) => Promise<T>,
    ): Promise<T> {
        throw new Error(
            'D1 does not support explicit transactions. Use `writeBatch(...)` for atomic write batching, or check `supportsInteractiveTransactions` before calling `transaction()`.',
        );
    }

    /**
     * D1 has no interactive transactions — use `db.batch([...])` for
     * atomic batched writes instead. Builds Drizzle query handles
     * (unawaited), passes them to D1's batch API, then maps results
     * back to the input operation order. No-op operations (e.g. an
     * update with an empty where clause) are returned as zero-affected
     * without occupying a batch slot.
     */
    override async writeBatch(
        operations: ReadonlyArray<OrmBatchOperation>,
    ): Promise<OrmBatchResult> {
        if (operations.length === 0) {
            return { affectedRows: 0, results: [] };
        }

        const queries: any[] = [];
        const opToQueryIndex: Array<number | null> = [];
        for (const op of operations) {
            const q = this.buildBatchQuery(this.db, op);
            if (q === null) {
                opToQueryIndex.push(null);
            } else {
                opToQueryIndex.push(queries.length);
                queries.push(q);
            }
        }

        if (queries.length === 0) {
            return {
                affectedRows: 0,
                results: operations.map(() => ({ affectedRows: 0, raw: null })),
            };
        }

        // drizzle-orm@0.45.2's D1 session `batch()` crashes on raw
        // statements: `SQLiteRaw._prepare()` returns itself, which has no
        // `stmt`, so a parameterized `db.run(sql`...`)` — every 'execute'
        // op with bound values — dies on `preparedQuery.stmt.bind(...)`
        // ("Cannot read properties of undefined (reading 'bind')").
        // Mirror the session's batching here with that hole patched:
        // prepare the statement from the built query text whenever the
        // prepared query carries none, then map results exactly as the
        // session would. Drop this when drizzle fixes SQLiteRaw batching.
        const prepared: any[] = queries.map((query) => query._prepare());
        const statements = prepared.map((preparedQuery) => {
            const builtQuery = preparedQuery.getQuery();
            const statement: D1PreparedStatement =
                preparedQuery.stmt ?? this.d1.prepare(builtQuery.sql);
            return builtQuery.params.length > 0
                ? statement.bind(...builtQuery.params)
                : statement;
        });
        const batchResults = await this.d1.batch(statements);
        const driverResults: any[] = batchResults.map((result, index) =>
            prepared[index].mapResult(result, true),
        );

        const results = operations.map((op, i) => {
            const queryIdx = opToQueryIndex[i];
            if (queryIdx === null) {
                return { affectedRows: 0, raw: null };
            }
            return this.convertBatchOpResult(op, driverResults[queryIdx]);
        });

        const totalAffected = results.reduce(
            (sum, r) => sum + (r.affectedRows ?? 0),
            0,
        );

        return { affectedRows: totalAffected, results };
    }

    protected override convertInsertResult<EntityType extends object>(
        driverResult: D1Result,
    ): OrmInsertResult<EntityType> {
        return {
            affectedRows: driverResult.meta.changes,
            raw: driverResult,
            insertedId: driverResult.meta.last_row_id,
        };
    }

    protected override convertUpdateResult<EntityType extends object>(
        driverResults: D1Result[],
    ): OrmUpdateResult<EntityType> {
        let totalAffectedRows = 0;

        for (const result of driverResults) {
            totalAffectedRows += result.meta.changes;
        }

        return {
            affectedRows: totalAffectedRows,
            raw: driverResults,
        };
    }

    protected override convertUpsertResult<EntityType extends object>(
        driverResults: D1Result[],
    ): OrmInsertResult<EntityType> {
        let totalAffectedRows = 0;

        for (const result of driverResults) {
            totalAffectedRows += result.meta.changes;
        }

        return {
            affectedRows: totalAffectedRows,
            raw: driverResults,
        };
    }

    protected override convertDeleteResult<EntityType extends object>(
        driverResult: D1Result,
    ): OrmDeleteResult<EntityType> {
        return {
            affectedRows: driverResult.meta.changes,
            raw: driverResult,
        };
    }
}
