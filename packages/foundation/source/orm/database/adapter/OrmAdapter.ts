// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { type SQLWrapper } from 'drizzle-orm';

import { OrmFindOptions } from '../../interfaces/find/OrmFindOptions';
import { OrmFindOptionsMany } from '../../interfaces/find/OrmFindOptionsMany';
import { OrmFindOptionsWhere } from '../../interfaces/find/OrmFindOptionsWhere';
import { OrmTimeSeriesOptions } from '../../interfaces/find/OrmTimeSeriesOptions';
import { OrmBatchOperation } from '../../interfaces/OrmBatchOperation';
import { OrmPartialEntity } from '../../interfaces/OrmPartialEntity';
import { OrmRawData } from '../../interfaces/OrmRawData';
import { OrmBatchResult } from '../../interfaces/result/OrmBatchResult';
import { OrmDeleteResult } from '../../interfaces/result/OrmDeleteResult';
import { OrmInsertResult } from '../../interfaces/result/OrmInsertResult';
import { OrmTimeSeriesResult } from '../../interfaces/result/OrmTimeSeriesResult';
import { OrmUpdateResult } from '../../interfaces/result/OrmUpdateResult';
import { OrmTableMetadata } from '../../metadata/OrmTableMetadata';
import { OrmDatabaseImpl } from '../internal/OrmDatabaseImpl';
import { OrmTransaction } from '../transaction/OrmTransaction';
import { OrmAdapterType } from './OrmAdapterType';
import { OrmDatabaseType } from './OrmDatabaseType';

export interface OrmAdapter {
    readonly databaseType: OrmDatabaseType;
    readonly adapterType: OrmAdapterType;

    /**
     * `true` if `transaction(...)` is supported (interactive read-write
     * transactions); `false` if only `writeBatch(...)` is available (D1).
     * Portable code should prefer `writeBatch` and check this flag only
     * when opportunistic use of `transaction` is worthwhile.
     */
    readonly supportsInteractiveTransactions: boolean;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute(query: SQLWrapper | string): Promise<any>;

    /**
     * Runs a raw query and returns its result rows, normalized from the
     * driver's shape into a plain array. See `OrmDatabase.executeRows`.
     */
    executeRows<RowType = Record<string, unknown>>(
        query: SQLWrapper | string,
    ): Promise<RowType[]>;

    /**
     * Interactive read-write transaction. Throws on adapters where
     * `supportsInteractiveTransactions === false` (D1). For portable
     * atomic writes, use `writeBatch`.
     */
    transaction<T>(
        context: OrmDatabaseImpl,
        callback: (tx: OrmTransaction) => Promise<T>,
    ): Promise<T>;

    /**
     * Execute a list of write operations atomically. Works on every
     * adapter — D1 maps to `db.batch([...])`, others wrap in a
     * transaction. The portable primitive for atomic writes.
     */
    writeBatch(
        operations: ReadonlyArray<OrmBatchOperation>,
    ): Promise<OrmBatchResult>;

    count<EntityType extends object>(
        metadata: OrmTableMetadata,
        options?: OrmFindOptionsMany<EntityType>,
    ): Promise<number>;

    find<EntityType extends object>(
        metadata: OrmTableMetadata,
        options?: OrmFindOptionsMany<EntityType>,
    ): Promise<OrmRawData<EntityType>[]>;

    findOne<EntityType extends object>(
        metadata: OrmTableMetadata,
        options?: OrmFindOptions<EntityType>,
    ): Promise<OrmRawData<EntityType> | null>;

    findAndCount<EntityType extends object>(
        metadata: OrmTableMetadata,
        options?: OrmFindOptionsMany<EntityType>,
    ): Promise<[OrmRawData<EntityType>[], number]>;

    insert<EntityType extends object>(
        metadata: OrmTableMetadata,
        values: ReadonlyArray<OrmPartialEntity<EntityType>>,
    ): Promise<OrmInsertResult<EntityType>>;

    update<EntityType extends object>(
        metadata: OrmTableMetadata,
        conditions: OrmFindOptionsWhere<EntityType>,
        values: OrmPartialEntity<EntityType>,
    ): Promise<OrmUpdateResult<EntityType>>;

    updateBatch<EntityType extends object>(
        metadata: OrmTableMetadata,
        operations: ReadonlyArray<{
            conditions: OrmPartialEntity<EntityType>;
            values: OrmPartialEntity<EntityType>;
        }>,
    ): Promise<OrmUpdateResult<EntityType>>;

    upsert<EntityType extends object>(
        metadata: OrmTableMetadata,
        conditions: OrmPartialEntity<EntityType>,
        values: OrmPartialEntity<EntityType>,
    ): Promise<OrmInsertResult<EntityType>>;

    upsertBatch<EntityType extends object>(
        metadata: OrmTableMetadata,
        operations: ReadonlyArray<{
            conditions: OrmPartialEntity<EntityType>;
            values: OrmPartialEntity<EntityType>;
        }>,
    ): Promise<OrmInsertResult<EntityType>>;

    increment<EntityType extends object>(
        metadata: OrmTableMetadata,
        conditions: OrmFindOptionsWhere<EntityType>,
        column: keyof EntityType & string,
        value?: number,
        additionalSet?: Record<string, unknown>,
    ): Promise<OrmUpdateResult<EntityType>>;

    decrement<EntityType extends object>(
        metadata: OrmTableMetadata,
        conditions: OrmFindOptionsWhere<EntityType>,
        column: keyof EntityType & string,
        value?: number,
        additionalSet?: Record<string, unknown>,
    ): Promise<OrmUpdateResult<EntityType>>;

    delete<EntityType extends object>(
        metadata: OrmTableMetadata,
        conditions: OrmFindOptionsWhere<EntityType>,
    ): Promise<OrmDeleteResult<EntityType>>;

    deleteBatch<EntityType extends object>(
        metadata: OrmTableMetadata,
        conditions: ReadonlyArray<OrmPartialEntity<EntityType>>,
    ): Promise<OrmDeleteResult<EntityType>>;

    truncate<EntityType extends object>(
        metadata: OrmTableMetadata,
    ): Promise<OrmDeleteResult<EntityType>>;

    timeSeries(
        tableName: string,
        column: string,
        options: OrmTimeSeriesOptions<object>,
    ): Promise<OrmTimeSeriesResult[]>;

    /**
     * Returns the largest chunk size that keeps a single statement's bound
     * parameters under the adapter's safe limit. Use this when chunking a
     * large input array in caller code (e.g. for an `IN (...)` filter or a
     * batched read) — pass the number of bound parameters each item
     * contributes. Pass `1` for a list of scalar IDs.
     */
    safeBatchSize(columnCount: number): number;

    dispose(): Promise<void>;
}
