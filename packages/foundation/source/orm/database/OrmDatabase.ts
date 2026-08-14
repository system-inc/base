// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { type SQLWrapper } from 'drizzle-orm';

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { OrmEntityClass } from '../entity/OrmEntityClass';
import { OrmTrackingEntity } from '../entity/OrmTrackingEntity';
import { OrmFindOptions } from '../interfaces/find/OrmFindOptions';
import { OrmFindOptionsMany } from '../interfaces/find/OrmFindOptionsMany';
import { OrmFindOptionsWhere } from '../interfaces/find/OrmFindOptionsWhere';
import { OrmTimeSeriesOptions } from '../interfaces/find/OrmTimeSeriesOptions';
import { OrmEntityKey, OrmPartialEntity } from '../interfaces/OrmPartialEntity';
import { OrmRawData } from '../interfaces/OrmRawData';
import { OrmBatchResult } from '../interfaces/result/OrmBatchResult';
import { OrmDeleteResult } from '../interfaces/result/OrmDeleteResult';
import { OrmInsertResult } from '../interfaces/result/OrmInsertResult';
import { OrmTimeSeriesResult } from '../interfaces/result/OrmTimeSeriesResult';
import { OrmUpdateResult } from '../interfaces/result/OrmUpdateResult';
import { OrmTableMetadata } from '../metadata/OrmTableMetadata';
import { OrmAdapter } from './adapter/OrmAdapter';
import { OrmRepository } from './repository/OrmRepository';
import { OrmDatabaseBatch } from './repository/OrmRepositoryBatch';
import { OrmTransaction } from './transaction/OrmTransaction';

export interface OrmDatabase {
    readonly name: string;

    getAdapter(): Promise<Pick<OrmAdapter, 'adapterType' | 'databaseType'>>;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute(query: SQLWrapper | string): Promise<any>;

    /**
     * Runs a raw query and returns its result rows in a
     * dialect-independent shape — the adapter normalizes the driver's
     * result (MySQL drivers resolve to `{ rows }`, SQLite drivers to the
     * array itself), so callers never branch on the backend.
     *
     * Use this for raw SELECTs. For driver-specific results
     * (`insertId`, `affectedRows`, DML statements), use {@link execute}.
     */
    executeRows<RowType = Record<string, unknown>>(
        query: SQLWrapper | string,
    ): Promise<RowType[]>;

    transaction<T>(callback: (tx: OrmTransaction) => Promise<T>): Promise<T>;

    getRepository<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
    ): OrmRepository<EntityType>;

    /**
     * Checks if entity metadata exist for the given entity class, target name or table name.
     */
    hasMetadata(target: OrmEntityClass): boolean;

    /**
     * Gets entity metadata for the given entity class or schema name.
     */
    getMetadata(target: OrmEntityClass): OrmTableMetadata | undefined;

    /**
     * All entity classes registered for this database.
     */
    getEntities(): OrmEntityClass[];

    /**
     * Resolves a registered entity class by its table name. Returns
     * `undefined` if no registered entity maps to that table. Scoped to
     * this database's configured entities, so it doubles as the
     * allow-list for table-name-addressed access.
     */
    getEntityByTableName(tableName: string): OrmEntityClass | undefined;

    /**
     * Counts entities that match given options.
     * Useful for pagination.
     */
    count<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        options?: OrmFindOptionsMany<EntityType>,
    ): Promise<number>;

    find<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        options?: OrmFindOptionsMany<EntityType>,
    ): Promise<OrmRawData<EntityType>[]>;

    findOne<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        options?: OrmFindOptions<EntityType>,
    ): Promise<OrmRawData<EntityType> | null>;

    findAndCount<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        options?: OrmFindOptionsMany<EntityType>,
    ): Promise<[OrmRawData<EntityType>[], number]>;

    insert<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        values: OrmPartialEntity<EntityType>,
    ): Promise<OrmInsertResult<EntityType>>;

    insertBatch<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        values: ReadonlyArray<OrmPartialEntity<EntityType>>,
    ): Promise<OrmInsertResult<EntityType>>;

    update<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        conditions: OrmFindOptionsWhere<EntityType>,
        values: OrmPartialEntity<EntityType>,
    ): Promise<OrmUpdateResult<EntityType>>;

    updateBatch<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        operations: ReadonlyArray<{
            conditions: OrmPartialEntity<EntityType>;
            values: OrmPartialEntity<EntityType>;
        }>,
    ): Promise<OrmUpdateResult<EntityType>>;

    upsert<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        conditions: OrmPartialEntity<EntityType>,
        values: OrmPartialEntity<EntityType>,
    ): Promise<OrmInsertResult<EntityType>>;

    upsertBatch<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        operations: ReadonlyArray<{
            conditions: OrmPartialEntity<EntityType>;
            values: OrmPartialEntity<EntityType>;
        }>,
    ): Promise<OrmInsertResult<EntityType>>;

    /**
     * Atomically execute a batch of writes spanning one or more entity
     * types. The portable primitive for atomic writes across all
     * adapters (including D1).
     */
    writeBatch(
        build: (batch: OrmDatabaseBatch) => void,
    ): Promise<OrmBatchResult>;

    delete<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        conditions: OrmFindOptionsWhere<EntityType>,
    ): Promise<OrmDeleteResult<EntityType>>;

    deleteBatch<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        conditions: ReadonlyArray<OrmPartialEntity<EntityType>>,
    ): Promise<OrmDeleteResult<EntityType>>;

    /**
     * Deletes every row in the table.
     *
     * Requires the target entity to be marked `truncatable: true` via
     * `@OrmTable({ truncatable: true })`. Tables that are not explicitly
     * marked as truncatable will throw at runtime.
     *
     * The `confirm: true` flag must be passed at every call site to make
     * the intent visible in code review — this method cannot be called
     * without spelling out that a full-table wipe is intended.
     */
    truncate<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        options: { confirm: true },
    ): Promise<OrmDeleteResult<EntityType>>;

    increment<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        conditions: OrmFindOptionsWhere<EntityType>,
        column: keyof EntityType & string,
        value?: number,
    ): Promise<OrmUpdateResult<EntityType>>;

    decrement<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        conditions: OrmFindOptionsWhere<EntityType>,
        column: keyof EntityType & string,
        value?: number,
    ): Promise<OrmUpdateResult<EntityType>>;

    timeSeries<EntityType extends OrmTrackingEntity>(
        target: Constructor<EntityType>,
        column: OrmEntityKey<EntityType>,
        options: OrmTimeSeriesOptions<EntityType>,
    ): Promise<OrmTimeSeriesResult[]>;

    /**
     * Returns the largest chunk size that keeps a single statement's bound
     * parameters under the underlying adapter's safe limit. Use this when
     * chunking a large input array in caller code (e.g. for an `IN (...)`
     * filter or a batched read). Pass `1` for a list of scalar IDs.
     */
    safeBatchSize(columnCount: number): Promise<number>;

    dispose(): Promise<void>;
}
