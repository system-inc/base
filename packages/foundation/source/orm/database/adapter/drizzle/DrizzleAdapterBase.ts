// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
    and,
    asc,
    between,
    count,
    desc,
    eq,
    exists,
    getTableName,
    gt,
    gte,
    inArray,
    isNotNull,
    isNull,
    like,
    lt,
    lte,
    ne,
    not,
    notBetween,
    notExists,
    notInArray,
    notLike,
    or,
    sql,
    SQLWrapper,
    type Column,
    type SQL,
    type Table,
} from 'drizzle-orm';

import { assertNever } from '@system-inc/base-common/type/AssertNever';
import { isOrmFilter, OrmFilter } from '../../../filters/OrmFilter';
import { OrmFindOptions } from '../../../interfaces/find/OrmFindOptions';
import { OrmFindOptionsMany } from '../../../interfaces/find/OrmFindOptionsMany';
import { OrmFindOptionsWhere } from '../../../interfaces/find/OrmFindOptionsWhere';
import {
    isParentColumnReference,
    OrmMappedJoin,
} from '../../../interfaces/find/OrmMappedJoin';
import { OrmTimeSeriesOptions } from '../../../interfaces/find/OrmTimeSeriesOptions';
import { OrmBatchOperation } from '../../../interfaces/OrmBatchOperation';
import { OrmPartialEntity } from '../../../interfaces/OrmPartialEntity';
import { OrmRawData } from '../../../interfaces/OrmRawData';
import { OrmBatchResult } from '../../../interfaces/result/OrmBatchResult';
import { OrmDeleteResult } from '../../../interfaces/result/OrmDeleteResult';
import { OrmInsertResult } from '../../../interfaces/result/OrmInsertResult';
import { OrmTimeSeriesResult } from '../../../interfaces/result/OrmTimeSeriesResult';
import { OrmUpdateResult } from '../../../interfaces/result/OrmUpdateResult';
import { OrmRelationMetadata } from '../../../metadata/OrmRelationMetadata';
import {
    ormGetTable,
    ormRequireTable,
} from '../../../metadata/OrmSchemaRegistry';
import {
    getPrimaryKeyPropertyKeys,
    OrmTableMetadata,
} from '../../../metadata/OrmTableMetadata';
import { OrmDatabaseImpl } from '../../internal/OrmDatabaseImpl';
import { OrmTransaction } from '../../transaction/OrmTransaction';
import { OrmAdapter } from '../OrmAdapter';
import { OrmAdapterType } from '../OrmAdapterType';
import { OrmDatabaseType } from '../OrmDatabaseType';
import { DrizzleTableLike, DrizzleTableQuery } from './types/DrizzleTableLike';

/**
 * The mutable form of OrmBatchResult the executors accumulate into before
 * returning it (OrmBatchResult.results is a ReadonlyArray, which can't be
 * pushed to).
 */
type BatchAccumulator = {
    results: Array<
        OrmInsertResult<object> | OrmUpdateResult<object> | OrmDeleteResult<object>
    >;
    affectedRows: number;
};

/**
 * Shared logic for Drizzle-backed adapters. Owns the dialect-agnostic CRUD
 * methods (count/find/update/delete/upsert/increment/decrement/...) and
 * filter/query-options building. Subclasses provide the driver-specific
 * pieces: the Drizzle `db` instance, transaction handling, batched mutators
 * (`insert` / `updateBatch` / `deleteBatch` / `upsertBatch` — different
 * batching/conflict semantics per dialect), and result conversion.
 *
 * `this.db` is typed `any` because the chained query builders Drizzle
 * returns differ across dialects; structurally typing the surface would
 * mean re-declaring most of Drizzle's API. The dialect-specific subclasses
 * narrow it back to a typed `MySqlDb`/`SQLiteDb`/etc. in their own field
 * declaration.
 */
export abstract class DrizzleAdapterBase implements OrmAdapter {
    readonly adapterType: OrmAdapterType = 'drizzle';
    abstract readonly databaseType: OrmDatabaseType;

    /**
     * Default: every Drizzle adapter except D1 can wrap `writeBatch` in a
     * native transaction. D1 overrides this to `false` (only supports
     * `db.batch()`, which `writeBatch` maps to natively).
     */
    readonly supportsInteractiveTransactions: boolean = true;

    protected abstract readonly db: any;
    protected abstract readonly maxSQLVariables: number;
    protected abstract readonly schema: Record<string, object>;

    //#region Abstract — driver/dialect-specific

    abstract execute(query: SQLWrapper | string): Promise<any>;

    abstract executeRows<RowType = Record<string, unknown>>(
        query: SQLWrapper | string,
    ): Promise<RowType[]>;

    abstract transaction<T>(
        context: OrmDatabaseImpl,
        callback: (tx: OrmTransaction) => Promise<T>,
    ): Promise<T>;

    abstract insert<EntityType extends object>(
        metadata: OrmTableMetadata,
        values: ReadonlyArray<OrmPartialEntity<EntityType>>,
    ): Promise<OrmInsertResult<EntityType>>;

    abstract updateBatch<EntityType extends object>(
        metadata: OrmTableMetadata,
        operations: ReadonlyArray<{
            conditions: OrmPartialEntity<EntityType>;
            values: OrmPartialEntity<EntityType>;
        }>,
    ): Promise<OrmUpdateResult<EntityType>>;

    abstract upsertBatch<EntityType extends object>(
        metadata: OrmTableMetadata,
        operations: ReadonlyArray<{
            conditions: OrmPartialEntity<EntityType>;
            values: OrmPartialEntity<EntityType>;
        }>,
    ): Promise<OrmInsertResult<EntityType>>;

    abstract deleteBatch<EntityType extends object>(
        metadata: OrmTableMetadata,
        conditions: ReadonlyArray<OrmPartialEntity<EntityType>>,
    ): Promise<OrmDeleteResult<EntityType>>;

    abstract timeSeries(
        tableName: string,
        column: string,
        options: OrmTimeSeriesOptions<object>,
    ): Promise<OrmTimeSeriesResult[]>;

    abstract dispose(): Promise<void>;

    /** Convert driver-specific insert result to ORM insert result. */
    protected abstract convertInsertResult<EntityType extends object>(
        driverResult: any,
    ): OrmInsertResult<EntityType>;

    /** Convert driver-specific update result(s) to ORM update result. */
    protected abstract convertUpdateResult<EntityType extends object>(
        driverResults: any[],
    ): OrmUpdateResult<EntityType>;

    /** Convert driver-specific upsert result(s) to ORM insert result. */
    protected abstract convertUpsertResult<EntityType extends object>(
        driverResults: any[],
    ): OrmInsertResult<EntityType>;

    /** Convert driver-specific delete result to ORM delete result. */
    protected abstract convertDeleteResult<EntityType extends object>(
        driverResult: any,
    ): OrmDeleteResult<EntityType>;

    //#endregion
    //#region Public — shared CRUD

    /**
     * Returns the largest chunk size that keeps a single statement's bound
     * parameters under `this.maxSQLVariables`, with a 10% headroom for
     * other parameters in the same query. Pass `1` for a list of scalar IDs.
     */
    safeBatchSize(columnCount: number): number {
        const effectiveLimit = Math.floor(this.maxSQLVariables * 0.9);
        if (columnCount <= 1) {
            return Math.max(1, effectiveLimit);
        }
        return Math.max(1, Math.floor(effectiveLimit / columnCount));
    }

    async count<EntityType extends object>(
        metadata: OrmTableMetadata,
        options?: OrmFindOptionsMany<EntityType>,
    ): Promise<number> {
        const table = this.schema[metadata.name];
        if (!table) {
            throw new Error(`Table '${metadata.name}' not found in schema`);
        }

        let query = this.db.select({ count: count() }).from(table).$dynamic();

        if (options?.where) {
            const conditions = this.buildWhereConditions(
                table,
                options.where,
                metadata,
            );
            if (conditions.length > 0) {
                query = query.where(or(...conditions));
            }
        }

        // limit/offset/order are deliberately NOT applied: an ungrouped
        // COUNT(*) returns exactly one row, so OFFSET >= 1 would skip it
        // and report 0 — count({...findOptions}) with pagination is the
        // standard "total for this list" call and counts ALL matching
        // rows (same where-only semantics findAndCount uses).
        const result = await query;
        return Array.isArray(result) ? (result[0]?.count ?? 0) : 0;
    }

    async find<EntityType extends object>(
        metadata: OrmTableMetadata,
        options?: OrmFindOptionsMany<EntityType>,
    ): Promise<OrmRawData<EntityType>[]> {
        const queryOptions = this.buildQueryOptions(metadata, options);
        const tableQuery = this.getTableQuery(this.db, metadata);

        if (options?.limit !== undefined) {
            queryOptions.limit = options.limit;
        }
        if (options?.offset !== undefined) {
            queryOptions.offset = options.offset;
        }

        const result = await tableQuery.findMany(queryOptions);
        return Array.isArray(result)
            ? (result as OrmRawData<EntityType>[])
            : [];
    }

    async findOne<EntityType extends object>(
        metadata: OrmTableMetadata,
        options?: OrmFindOptions<EntityType>,
    ): Promise<OrmRawData<EntityType> | null> {
        const queryOptions = this.buildQueryOptions(metadata, options);
        const tableQuery = this.getTableQuery(this.db, metadata);

        const result = await tableQuery.findFirst(queryOptions);
        return (result as OrmRawData<EntityType>) ?? null;
    }

    async findAndCount<EntityType extends object>(
        metadata: OrmTableMetadata,
        options?: OrmFindOptionsMany<EntityType>,
    ): Promise<[OrmRawData<EntityType>[], number]> {
        // Run both queries in parallel; count excludes limit/offset for total.
        const [items, totalCount] = await Promise.all([
            this.find(metadata, options),
            this.count(metadata, { where: options?.where }),
        ]);
        return [items, totalCount];
    }

    async update<EntityType extends object>(
        metadata: OrmTableMetadata,
        conditions: OrmFindOptionsWhere<EntityType>,
        values: OrmPartialEntity<EntityType>,
    ): Promise<OrmUpdateResult<EntityType>> {
        const table = this.schema[metadata.name];
        if (!table) {
            throw new Error(`Table '${metadata.name}' not found in schema`);
        }

        const whereConditions = this.buildWhereConditions(table, conditions);
        if (whereConditions.length === 0) {
            return { affectedRows: 0, raw: null };
        }

        const result: any = await this.db
            .update(table)
            .set(values)
            .where(
                whereConditions.length === 1
                    ? whereConditions[0]
                    : and(...whereConditions)!,
            );

        return this.convertUpdateResult([result]);
    }

    /**
     * Native upsert — single atomic statement using the dialect's conflict
     * resolution syntax (`ON CONFLICT DO UPDATE` on SQLite/Postgres,
     * `ON DUPLICATE KEY UPDATE` on MySQL). The dialect-specific work lives
     * in `upsertBatch`; this is the single-row convenience wrapper.
     *
     * `conditions` holds the entity's identifying fields (typically the
     * primary key). It's not a `where` clause — there's no read involved.
     */
    async upsert<EntityType extends object>(
        metadata: OrmTableMetadata,
        conditions: OrmPartialEntity<EntityType>,
        values: OrmPartialEntity<EntityType>,
    ): Promise<OrmInsertResult<EntityType>> {
        return this.upsertBatch(metadata, [{ conditions, values }]);
    }

    /**
     * Atomic batch of write operations. Default impl wraps the operations
     * in a Drizzle transaction; D1 overrides to use `db.batch([...])`
     * since it has no transaction support. Either way, all operations
     * commit together or none do.
     */
    async writeBatch(
        operations: ReadonlyArray<OrmBatchOperation>,
    ): Promise<OrmBatchResult> {
        if (operations.length === 0) {
            return { affectedRows: 0, results: [] };
        }

        return await this.db.transaction(async (tx: any) => {
            return await this.executeBatchOperations(tx, operations);
        });
    }

    /**
     * Groups update operations by identical values so rows getting the
     * same SET batch into one statement (shared by both dialects'
     * updateBatch). No-op operations — an empty values object, e.g. a
     * loaded entity saved without modifications and carrying no
     * update-date column — are SKIPPED: drizzle throws "No values to
     * set" on an empty SET, which turned a legitimate
     * load-maybe-modify-save flow into an error (and aborted whole
     * atomic batches for one clean entity).
     */
    protected groupUpdateOperations<EntityType extends object>(
        operations: ReadonlyArray<{
            conditions: OrmPartialEntity<EntityType>;
            values: OrmPartialEntity<EntityType>;
        }>,
    ): Map<
        string,
        {
            values: OrmPartialEntity<EntityType>;
            conditions: OrmPartialEntity<EntityType>[];
        }
    > {
        const updateGroups = new Map<
            string,
            {
                values: OrmPartialEntity<EntityType>;
                conditions: OrmPartialEntity<EntityType>[];
            }
        >();
        for (const operation of operations) {
            if (Object.keys(operation.values).length === 0) {
                continue;
            }
            // BigInt has no toJSON — a bare JSON.stringify throws for
            // bigint-mode column values before any SQL runs. The 'n'
            // suffix keeps 123n distinct from the string '123'.
            const valuesKey = JSON.stringify(operation.values, (_, value) =>
                typeof value === 'bigint' ? `${value}n` : value,
            );
            const group = updateGroups.get(valuesKey);
            if (group) {
                group.conditions.push(operation.conditions);
            } else {
                updateGroups.set(valuesKey, {
                    values: operation.values,
                    conditions: [operation.conditions],
                });
            }
        }
        return updateGroups;
    }

    /**
     * Fold one batch op's driver result into an accumulator: no-op ops (a null
     * query) contribute an empty result, otherwise the driver result is converted
     * and its affected-row count added. The build → null-skip → convert → fold
     * shape is identical for the async and sync executors; only HOW a query runs
     * differs (await vs `.run()`), which is why that step stays in each loop.
     */
    private foldBatchOp(
        op: OrmBatchOperation,
        query: any,
        driverResult: any,
        accumulator: BatchAccumulator,
    ): void {
        if (query === null) {
            accumulator.results.push({ affectedRows: 0, raw: null });
            return;
        }
        const result = this.convertBatchOpResult(op, driverResult);
        accumulator.results.push(result);
        accumulator.affectedRows += result.affectedRows ?? 0;
    }

    /**
     * Runs the batch operations sequentially against `dbOrTx` and folds
     * their results. The caller owns atomicity: the default `writeBatch`
     * wraps this in a Drizzle transaction, `DurableAdapter` wraps it in
     * the async-safe `storage.transaction`, D1 bypasses it entirely for
     * `db.batch`.
     */
    protected async executeBatchOperations(
        dbOrTx: any,
        operations: ReadonlyArray<OrmBatchOperation>,
    ): Promise<OrmBatchResult> {
        const accumulator: BatchAccumulator = { results: [], affectedRows: 0 };
        for (const op of operations) {
            const query = this.buildBatchQuery(dbOrTx, op);
            const driverResult = query === null ? null : await query;
            this.foldBatchOp(op, query, driverResult, accumulator);
        }
        return accumulator;
    }

    /**
     * Synchronous mirror of `executeBatchOperations`, for drivers whose
     * transaction wrapper is synchronous and rejects a promise-returning callback
     * (better-sqlite3 v12+ throws "Transaction function cannot return a promise").
     * The build/fold logic is shared via `foldBatchOp`; the ONLY difference is the
     * run step: a drizzle builder doesn't auto-run synchronously (only `await`
     * triggers its thenable), so query-builder ops execute via their `.run()`,
     * while the `execute` kind already ran inside `buildBatchQuery` (its
     * `dbOrTx.run(...)` returned the result object) and passes through unchanged.
     */
    protected executeBatchOperationsSync(
        dbOrTx: any,
        operations: ReadonlyArray<OrmBatchOperation>,
    ): OrmBatchResult {
        const accumulator: BatchAccumulator = { results: [], affectedRows: 0 };
        for (const op of operations) {
            const query = this.buildBatchQuery(dbOrTx, op);
            const driverResult =
                query === null ? null : query.run !== undefined ? query.run() : query;
            this.foldBatchOp(op, query, driverResult, accumulator);
        }
        return accumulator;
    }

    /**
     * Construct a Drizzle query builder for a single batch op against
     * `dbOrTx` (either `this.db` or a transaction handle). Returns `null`
     * for operations that would be no-ops (e.g. an update with no
     * matching conditions). Subclass-specific upsert syntax is delegated
     * to `buildBatchUpsertQuery`.
     */
    protected buildBatchQuery(dbOrTx: any, op: OrmBatchOperation): any {
        if (op.kind === 'execute') {
            const query =
                typeof op.query === 'string' ? sql.raw(op.query) : op.query;
            // MySQL exposes raw execution as `execute`, SQLite as `run`;
            // both return lazily-executed thenables, so D1's batch API
            // can collect them unawaited.
            return this.databaseType.dialect === 'mysql'
                ? dbOrTx.execute(query)
                : dbOrTx.run(query);
        }

        const table = this.schema[op.metadata.name];
        if (!table) {
            throw new Error(`Table '${op.metadata.name}' not found in schema`);
        }

        switch (op.kind) {
            case 'insert': {
                if (op.values.length === 0) return null;
                return dbOrTx.insert(table).values(op.values);
            }
            case 'update': {
                // An empty SET is a no-op, not an error — drizzle would
                // throw "No values to set" and abort the whole batch for
                // one clean entity.
                if (Object.keys(op.values).length === 0) return null;
                const whereConditions = this.buildWhereConditions(
                    table,
                    op.conditions,
                );
                if (whereConditions.length === 0) return null;
                return dbOrTx
                    .update(table)
                    .set(op.values)
                    .where(
                        whereConditions.length === 1
                            ? whereConditions[0]
                            : and(...whereConditions)!,
                    );
            }
            case 'delete': {
                const whereConditions = this.buildWhereConditions(
                    table,
                    op.conditions,
                );
                if (whereConditions.length === 0) return null;
                return dbOrTx
                    .delete(table)
                    .where(
                        whereConditions.length === 1
                            ? whereConditions[0]
                            : and(...whereConditions)!,
                    );
            }
            case 'upsert': {
                return this.buildBatchUpsertQuery(
                    dbOrTx,
                    op.metadata,
                    table,
                    op.conditions,
                    op.values,
                );
            }
        }
    }

    /**
     * Dialect-specific upsert query construction. SQLite/Postgres use
     * `ON CONFLICT DO UPDATE`, MySQL uses `ON DUPLICATE KEY UPDATE`.
     * Subclasses provide the actual builder.
     */
    protected abstract buildBatchUpsertQuery(
        dbOrTx: any,
        metadata: OrmTableMetadata,
        table: object,
        conditions: OrmPartialEntity<object>,
        values: OrmPartialEntity<object>,
    ): any;

    /** Convert a driver result to the right Orm*Result shape for the op. */
    protected convertBatchOpResult(
        op: OrmBatchOperation,
        driverResult: any,
    ):
        | OrmInsertResult<object>
        | OrmUpdateResult<object>
        | OrmDeleteResult<object> {
        switch (op.kind) {
            case 'insert':
                return this.convertInsertResult(driverResult);
            case 'update':
                return this.convertUpdateResult([driverResult]);
            case 'delete':
                return this.convertDeleteResult(driverResult);
            case 'upsert':
                // One batch op addresses exactly one row (rows-addressed
                // contract; dialect encodings never reach callers).
                return {
                    ...this.convertUpsertResult([driverResult]),
                    affectedRows: 1,
                };
            case 'execute':
                // Raw statements reuse the update-result conversion —
                // both report driver affected-row counts.
                return this.convertUpdateResult([driverResult]);
        }
    }

    async increment<EntityType extends object>(
        metadata: OrmTableMetadata,
        conditions: OrmFindOptionsWhere<EntityType>,
        column: keyof EntityType & string,
        value: number = 1,
        additionalSet?: Record<string, unknown>,
    ): Promise<OrmUpdateResult<EntityType>> {
        return this.arithmeticUpdate(
            metadata,
            conditions,
            column,
            value,
            '+',
            additionalSet,
        );
    }

    async decrement<EntityType extends object>(
        metadata: OrmTableMetadata,
        conditions: OrmFindOptionsWhere<EntityType>,
        column: keyof EntityType & string,
        value: number = 1,
        additionalSet?: Record<string, unknown>,
    ): Promise<OrmUpdateResult<EntityType>> {
        return this.arithmeticUpdate(
            metadata,
            conditions,
            column,
            value,
            '-',
            additionalSet,
        );
    }

    async delete<EntityType extends object>(
        metadata: OrmTableMetadata,
        conditions: OrmFindOptionsWhere<EntityType>,
    ): Promise<OrmDeleteResult<EntityType>> {
        const table = this.schema[metadata.name];
        if (!table) {
            throw new Error(`Table '${metadata.name}' not found in schema`);
        }

        const whereConditions = this.buildWhereConditions(table, conditions);
        if (whereConditions.length === 0) {
            return { affectedRows: 0, raw: null };
        }

        const result: any = await this.db
            .delete(table)
            .where(
                whereConditions.length === 1
                    ? whereConditions[0]
                    : and(...whereConditions)!,
            );

        return this.convertDeleteResult(result);
    }

    async truncate<EntityType extends object>(
        metadata: OrmTableMetadata,
    ): Promise<OrmDeleteResult<EntityType>> {
        const table = this.schema[metadata.name];
        if (!table) {
            throw new Error(`Table '${metadata.name}' not found in schema`);
        }
        const result: any = await this.db.delete(table);
        return this.convertDeleteResult(result);
    }

    //#endregion
    //#region Protected helpers

    /**
     * Resolves the per-item column count from `metadata` when available
     * (covers all columns Drizzle binds, including defaults), otherwise
     * falls back to the keys on the sample record.
     */
    protected calculateSafeBatchSize(
        sampleRecord: Record<string, unknown>,
        metadata?: OrmTableMetadata,
    ): number {
        const columnCount = metadata
            ? metadata.columns.length
            : Object.keys(sampleRecord).length;
        return this.safeBatchSize(columnCount);
    }

    protected async executeBatched<T, R>(
        items: ReadonlyArray<T>,
        operation: (batch: ReadonlyArray<T>) => Promise<R>,
        getSampleRecord: (item: T) => Record<string, unknown>,
        metadata?: OrmTableMetadata,
    ): Promise<R[]> {
        if (items.length === 0) {
            return [];
        }

        const safeBatchSize = this.calculateSafeBatchSize(
            getSampleRecord(items[0]),
            metadata,
        );

        if (items.length <= safeBatchSize) {
            return [await operation(items)];
        }

        const results: R[] = [];
        for (let i = 0; i < items.length; i += safeBatchSize) {
            const batch = items.slice(
                i,
                Math.min(i + safeBatchSize, items.length),
            );
            const result = await operation(batch);
            results.push(result);
        }

        return results;
    }

    /**
     * Reaches into Drizzle's relational query API (`db.query.{tableName}`),
     * which isn't exposed on the public type. The cast is the price of
     * that API surface.
     */
    protected getTableQuery(
        db: object,
        metadata: OrmTableMetadata,
    ): DrizzleTableQuery {
        const queryApi = (db as { query?: Record<string, DrizzleTableQuery> })
            .query;
        const tableQuery = queryApi?.[metadata.name];
        if (!tableQuery) {
            throw new Error(
                `Query API not available for table '${metadata.name}'. Ensure the schema is properly configured.`,
            );
        }
        return tableQuery;
    }

    /**
     * Drizzle tables expose their columns as own properties keyed by column
     * name, but the public table type doesn't model that as an index
     * signature. This helper centralizes the cast.
     */
    protected getTableColumn(
        table: object,
        columnName: string,
    ): Column | undefined {
        return (table as DrizzleTableLike)[columnName];
    }

    /**
     * Resolve a property key to its Drizzle column, throwing if it isn't one.
     *
     * Every query-builder surface that maps a caller-supplied key to a column
     * (`where`, `order`, `select`, …) routes through here so an unrecognized
     * key — a relation, or a typo — fails loud instead of being silently
     * dropped and returning confidently-wrong rows. `action` is the verb shown
     * in the error, e.g. `'filter by'`, `'order by'`, `'select'`.
     */
    protected resolveColumnOrThrow(
        table: object,
        key: string,
        action: string,
    ): Column {
        const column = (table as DrizzleTableLike)[key];
        if (!column) {
            throw new Error(
                `Cannot ${action} '${key}' on '${getTableName(table as Table)}': it is not a column. ` +
                    `Only the entity's own columns are supported here — if '${key}' is a relation, ` +
                    `query the related entity directly or use 'execute()' for raw SQL.`,
            );
        }
        return column;
    }

    protected buildQueryOptions<EntityType extends object>(
        metadata: OrmTableMetadata,
        options?: OrmFindOptions<EntityType> | OrmFindOptionsMany<EntityType>,
    ): Record<string, unknown> {
        const queryOptions: Record<string, unknown> = {};

        if (options?.relations && Object.keys(options.relations).length > 0) {
            queryOptions.with = this.buildWithClause(
                options.relations as Record<string, unknown>,
            );
        }

        if (options?.joins && options.joins.length > 0) {
            const table = this.schema[metadata.name];
            if (!table) {
                throw new Error(`Table '${metadata.name}' not found in schema`);
            }
            queryOptions.extras = this.buildMappedJoinExtras(
                metadata,
                table as DrizzleTableLike,
                options.joins,
            );
        }

        if (options?.where) {
            const table = this.schema[metadata.name];
            if (!table) {
                throw new Error(`Table '${metadata.name}' not found in schema`);
            }
            queryOptions.where = (t: object) => {
                const conditions = this.buildWhereConditions(
                    t || table,
                    options.where!,
                    metadata,
                );
                return conditions.length > 0 ? or(...conditions) : undefined;
            };
        }

        // `OrmEntityKeys` is an array of column names, but Drizzle's
        // relational query builder expects `columns` as an object map
        // `{ [name]: true }`. Without conversion Drizzle silently ignores
        // the projection (array indices aren't valid column names) and
        // returns every column — which broke long-conversation memory
        // budgets in chat-engine where the intent was to skip `content` and
        // `path`. Drizzle *also* silently ignores unknown column keys in that
        // map, so each key is validated against the table first.
        if (options?.select) {
            const table = this.schema[metadata.name];
            if (!table) {
                throw new Error(`Table '${metadata.name}' not found in schema`);
            }
            const selectInput = options.select as
                | ReadonlyArray<string>
                | Record<string, boolean>;
            const columnsMap: Record<string, boolean> = {};
            if (Array.isArray(selectInput)) {
                for (const key of selectInput) {
                    this.resolveColumnOrThrow(table, key, 'select');
                    columnsMap[key] = true;
                }
            } else {
                for (const [key, include] of Object.entries(selectInput)) {
                    this.resolveColumnOrThrow(table, key, 'select');
                    columnsMap[key] = include;
                }
            }
            queryOptions.columns = columnsMap;
        }

        if (options?.order) {
            if (!this.schema[metadata.name]) {
                throw new Error(`Table '${metadata.name}' not found in schema`);
            }
            queryOptions.orderBy = (table: DrizzleTableLike) => {
                const orderConditions: SQL[] = [];
                for (const [key, direction] of Object.entries(options.order!)) {
                    const column = this.resolveColumnOrThrow(
                        table,
                        key,
                        'order by',
                    );
                    orderConditions.push(
                        direction === 'DESC' ? desc(column) : asc(column),
                    );
                }
                return orderConditions;
            };
        }

        return queryOptions;
    }

    protected buildWithClause(
        relations: Record<string, unknown>,
    ): Record<string, unknown> {
        const withClause: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(relations)) {
            if (value === true) {
                withClause[key] = true;
            } else if (typeof value === 'object' && value !== null) {
                withClause[key] = {
                    with: this.buildWithClause(
                        value as Record<string, unknown>,
                    ),
                };
            }
        }

        return withClause;
    }

    //#region Mapped Joins

    /**
     * Compiles mapped joins into Drizzle relational-query `extras`: each
     * join becomes a correlated subquery that JSON-aggregates the joined
     * rows, so the whole find — main entity, declared relations, and any
     * number of mapped joins — stays a single SQL statement and a single
     * database round trip. The hydrator parses the JSON columns back
     * into entity instances.
     */
    protected buildMappedJoinExtras(
        metadata: OrmTableMetadata,
        table: DrizzleTableLike,
        joins: ReadonlyArray<OrmMappedJoin<any>>,
    ): Record<string, SQL.Aliased> {
        const aliasCounter = { value: 0 };
        const extras: Record<string, SQL.Aliased> = {};
        for (const join of joins) {
            extras[join.property] = this.buildMappedJoinSubquery(
                join,
                { metadata, table },
                aliasCounter,
            ).as(join.property);
        }
        return extras;
    }

    private buildMappedJoinSubquery(
        join: OrmMappedJoin<any>,
        parent: {
            metadata: OrmTableMetadata;
            table?: DrizzleTableLike;
            alias?: string;
        },
        aliasCounter: { value: number },
    ): SQL {
        const joinedMetadata = ormGetTable(join.entity);
        if (!joinedMetadata) {
            throw new Error(
                `Mapped join entity ${join.entity.name} is not registered as an @OrmTable.`,
            );
        }

        const alias = `__mj${aliasCounter.value++}`;
        const jsonRow = this.buildJoinJsonRow(
            joinedMetadata,
            alias,
            join.relations as Record<string, unknown> | undefined,
            join.joins,
            aliasCounter,
        );
        const fromClause = sql.raw(
            `${this.quoteSqlIdentifier(joinedMetadata.name)} AS ${alias}`,
        );
        const conditions = this.buildJoinConditions(
            join.where,
            joinedMetadata,
            alias,
            parent,
        );
        const whereClause =
            conditions.length > 0
                ? sql` WHERE ${sql.join(conditions, sql.raw(' AND '))}`
                : sql``;

        if (join.type === 'many') {
            const aggregated =
                this.databaseType.dialect === 'mysql'
                    ? sql`json_arrayagg(${jsonRow})`
                    : sql`json_group_array(json(${jsonRow}))`;
            return sql`(SELECT ${aggregated} FROM ${fromClause}${whereClause})`;
        }
        return sql`(SELECT ${jsonRow} FROM ${fromClause}${whereClause} LIMIT 1)`;
    }

    /**
     * Builds the `json_object('property', alias.column, ...)` expression
     * for one row of the joined entity, including any requested declared
     * relations and nested mapped joins as nested JSON values. Keys are
     * property keys so the hydrator can map results directly.
     */
    private buildJoinJsonRow(
        metadata: OrmTableMetadata,
        alias: string,
        relations: Record<string, unknown> | undefined,
        nestedJoins: ReadonlyArray<OrmMappedJoin<any>> | undefined,
        aliasCounter: { value: number },
    ): SQL {
        const parts: SQL[] = [];

        for (const column of metadata.columns) {
            // Binary columns have no faithful JSON representation.
            if (column.type.kind === 'bytes') {
                continue;
            }
            const columnName = column.options?.name ?? column.propertyKey;
            const columnRef = `${alias}.${this.quoteSqlIdentifier(columnName)}`;
            // bigint/decimal must ride the JSON as EXACT digit strings and
            // be re-typed on hydration: a raw MySQL BIGINT/DECIMAL becomes
            // a JSON number that parses to a lossy float64 (silent
            // corruption of money and >2^53 ids), and SQLite's blob-backed
            // bigint storage makes json_object throw outright. CAST is
            // exact in both dialects; the hydrator's per-mode coercion
            // restores the declared runtime type.
            const projection =
                column.type.kind === 'bigint' || column.type.kind === 'decimal'
                    ? `CAST(${columnRef} AS ${this.databaseType.dialect === 'mysql' ? 'CHAR' : 'TEXT'})`
                    : columnRef;
            parts.push(sql.raw(`'${column.propertyKey}', ${projection}`));
        }

        if (relations) {
            for (const [propertyKey, value] of Object.entries(relations)) {
                if (!value) {
                    continue;
                }
                const subquery = this.buildDeclaredRelationSubquery(
                    metadata,
                    alias,
                    propertyKey,
                    typeof value === 'object'
                        ? (value as Record<string, unknown>)
                        : undefined,
                    aliasCounter,
                );
                parts.push(sql`${sql.raw(`'${propertyKey}', `)}${subquery}`);
            }
        }

        if (nestedJoins) {
            for (const nestedJoin of nestedJoins) {
                const subquery = this.buildMappedJoinSubquery(
                    nestedJoin,
                    { metadata, alias },
                    aliasCounter,
                );
                parts.push(
                    sql`${sql.raw(`'${nestedJoin.property}', `)}${this.wrapNestedJsonValue(subquery)}`,
                );
            }
        }

        return sql`json_object(${sql.join(parts, sql.raw(', '))})`;
    }

    /**
     * Builds the correlated subquery for a *declared* relation of a
     * mapped-join entity, nested into its JSON row.
     */
    private buildDeclaredRelationSubquery(
        metadata: OrmTableMetadata,
        alias: string,
        propertyKey: string,
        nestedRelations: Record<string, unknown> | undefined,
        aliasCounter: { value: number },
    ): SQL {
        const relation = metadata.relations.find(
            (candidate) => candidate.propertyKey === propertyKey,
        );
        if (!relation) {
            throw new Error(
                `Mapped join: '${propertyKey}' is not a declared relation of ${metadata.name}.`,
            );
        }

        const targetMetadata = ormGetTable(relation.target());
        if (!targetMetadata) {
            throw new Error(
                `Mapped join: relation '${propertyKey}' of ${metadata.name} targets an entity without @OrmTable metadata.`,
            );
        }

        const childAlias = `__mj${aliasCounter.value++}`;
        const jsonRow = this.buildJoinJsonRow(
            targetMetadata,
            childAlias,
            nestedRelations,
            undefined,
            aliasCounter,
        );
        const fromClause = sql.raw(
            `${this.quoteSqlIdentifier(targetMetadata.name)} AS ${childAlias}`,
        );

        if (relation.type === 'many-to-one' || relation.type === 'one-to-one') {
            const joinColumnName = this.resolveColumnDatabaseName(
                metadata,
                relation.joinColumn,
            );
            const referencedProperty =
                metadata.joinColumns?.[propertyKey]?.referencedColumnName ??
                getPrimaryKeyPropertyKeys(targetMetadata)[0];
            const referencedColumnName = this.resolveColumnDatabaseName(
                targetMetadata,
                referencedProperty,
            );
            return this.wrapNestedJsonValue(
                sql`(SELECT ${jsonRow} FROM ${fromClause} WHERE ${sql.raw(
                    `${childAlias}.${this.quoteSqlIdentifier(referencedColumnName)} = ${alias}.${this.quoteSqlIdentifier(joinColumnName)}`,
                )} LIMIT 1)`,
            );
        }

        // one-to-many: join through the inverse many-to-one on the target
        const inverseRelation = targetMetadata.relations.find(
            (candidate) => candidate.propertyKey === relation.inverseSide,
        );
        if (
            !inverseRelation ||
            (inverseRelation.type !== 'many-to-one' &&
                inverseRelation.type !== 'one-to-one')
        ) {
            throw new Error(
                `Mapped join: one-to-many relation '${propertyKey}' of ${metadata.name} has no inverse many-to-one '${relation.inverseSide}' on ${targetMetadata.name}.`,
            );
        }
        const inverseJoinColumnName = this.resolveColumnDatabaseName(
            targetMetadata,
            inverseRelation.joinColumn,
        );
        const referencedProperty =
            targetMetadata.joinColumns?.[inverseRelation.propertyKey]
                ?.referencedColumnName ??
            getPrimaryKeyPropertyKeys(metadata)[0];
        const referencedColumnName = this.resolveColumnDatabaseName(
            metadata,
            referencedProperty,
        );

        const aggregated =
            this.databaseType.dialect === 'mysql'
                ? sql`json_arrayagg(${jsonRow})`
                : sql`json_group_array(json(${jsonRow}))`;
        return this.wrapNestedJsonValue(
            sql`(SELECT ${aggregated} FROM ${fromClause} WHERE ${sql.raw(
                `${childAlias}.${this.quoteSqlIdentifier(inverseJoinColumnName)} = ${alias}.${this.quoteSqlIdentifier(referencedColumnName)}`,
            )})`,
        );
    }

    private buildJoinConditions(
        where: Record<string, unknown>,
        metadata: OrmTableMetadata,
        alias: string,
        parent: {
            metadata: OrmTableMetadata;
            table?: DrizzleTableLike;
            alias?: string;
        },
    ): SQL[] {
        const conditions: SQL[] = [];
        for (const [key, value] of Object.entries(where)) {
            if (value === undefined) {
                continue;
            }
            const columnName = this.resolveColumnDatabaseName(metadata, key);
            const columnRef = sql.raw(
                `${alias}.${this.quoteSqlIdentifier(columnName)}`,
            );

            if (value === null) {
                conditions.push(sql`${columnRef} IS NULL`);
            } else if (isParentColumnReference(value)) {
                conditions.push(
                    sql`${columnRef} = ${this.buildParentColumnRef(value.column, parent)}`,
                );
            } else if (isOrmFilter(value)) {
                conditions.push(
                    this.buildJoinFilterCondition(columnRef, value),
                );
            } else {
                conditions.push(
                    sql`${columnRef} = ${this.encodeJoinParameter(value)}`,
                );
            }
        }
        return conditions;
    }

    private buildParentColumnRef(
        column: string,
        parent: {
            metadata: OrmTableMetadata;
            table?: DrizzleTableLike;
            alias?: string;
        },
    ): SQL | Column {
        if (parent.alias) {
            const columnName = this.resolveColumnDatabaseName(
                parent.metadata,
                column,
            );
            return sql.raw(
                `${parent.alias}.${this.quoteSqlIdentifier(columnName)}`,
            );
        }
        if (parent.table) {
            // The root table is referenced through its Drizzle column so
            // the emitted identifier matches however the relational query
            // qualifies the root.
            const propertyKey = this.resolveColumnPropertyKey(
                parent.metadata,
                column,
            );
            const tableColumn = this.getTableColumn(parent.table, propertyKey);
            if (!tableColumn) {
                throw new Error(
                    `Mapped join: parent column '${column}' not found on table ${parent.metadata.name}.`,
                );
            }
            return tableColumn;
        }
        throw new Error('Mapped join: parent reference is missing a table.');
    }

    private buildJoinFilterCondition(columnRef: SQL, filter: OrmFilter): SQL {
        switch (filter.type) {
            // Same null normalization as buildConditionForValue: `= NULL`
            // matches nothing under three-valued logic.
            case 'eq':
                return filter.value === null
                    ? sql`${columnRef} IS NULL`
                    : sql`${columnRef} = ${this.encodeJoinParameter(filter.value)}`;
            case 'ne':
                return filter.value === null
                    ? sql`${columnRef} IS NOT NULL`
                    : sql`${columnRef} != ${this.encodeJoinParameter(filter.value)}`;
            case 'gt':
                return sql`${columnRef} > ${this.encodeJoinParameter(filter.value)}`;
            case 'gte':
                return sql`${columnRef} >= ${this.encodeJoinParameter(filter.value)}`;
            case 'lt':
                return sql`${columnRef} < ${this.encodeJoinParameter(filter.value)}`;
            case 'lte':
                return sql`${columnRef} <= ${this.encodeJoinParameter(filter.value)}`;
            case 'in':
            case 'notIn': {
                const values = filter.value.map(
                    (item: unknown) => sql`${this.encodeJoinParameter(item)}`,
                );
                if (values.length === 0) {
                    // Empty IN is invalid SQL; emit the logical constant.
                    return filter.type === 'in' ? sql`1 = 0` : sql`1 = 1`;
                }
                const list = sql.join(values, sql.raw(', '));
                return filter.type === 'in'
                    ? sql`${columnRef} IN (${list})`
                    : sql`${columnRef} NOT IN (${list})`;
            }
            case 'between':
                return sql`${columnRef} BETWEEN ${this.encodeJoinParameter(filter.min)} AND ${this.encodeJoinParameter(filter.max)}`;
            case 'notBetween':
                return sql`${columnRef} NOT BETWEEN ${this.encodeJoinParameter(filter.min)} AND ${this.encodeJoinParameter(filter.max)}`;
            case 'like':
                return sql`${columnRef} LIKE ${filter.pattern}`;
            case 'notLike':
                return sql`${columnRef} NOT LIKE ${filter.pattern}`;
            case 'isNull':
                return sql`${columnRef} IS NULL`;
            case 'isNotNull':
                return sql`${columnRef} IS NOT NULL`;
            case 'exists':
            case 'notExists':
            case 'and':
            case 'or':
            case 'not':
                throw new Error(
                    `Mapped join: filter '${filter.type}' is not supported in a mapped join's where.`,
                );
        }
    }

    /**
     * Encodes a parameter for use inside a mapped-join subquery. Dates
     * are bound as strings because the raw SQL path bypasses the
     * driver's column-level Date handling.
     */
    private encodeJoinParameter(value: unknown): unknown {
        if (value instanceof Date) {
            if (this.databaseType.dialect === 'mysql') {
                // MySQL datetime literal, UTC.
                return value.toISOString().replace('T', ' ').replace('Z', '');
            }
            return value.toISOString();
        }
        return value;
    }

    /**
     * SQLite's json_object() returns TEXT — nesting it as a value inside
     * another json_object would embed a string instead of an object
     * unless wrapped in json(). MySQL's JSON type nests natively.
     */
    private wrapNestedJsonValue(subquery: SQL): SQL {
        if (this.databaseType.dialect === 'sqlite') {
            return sql`json(${subquery})`;
        }
        return subquery;
    }

    private quoteSqlIdentifier(name: string): string {
        if (this.databaseType.dialect === 'mysql') {
            return `\`${name.replace(/`/g, '``')}\``;
        }
        return `"${name.replace(/"/g, '""')}"`;
    }

    private resolveColumnDatabaseName(
        metadata: OrmTableMetadata,
        nameOrProperty: string,
    ): string {
        for (const column of metadata.columns) {
            if (column.propertyKey === nameOrProperty) {
                return column.options?.name ?? column.propertyKey;
            }
        }
        for (const column of metadata.columns) {
            if (column.options?.name === nameOrProperty) {
                return column.options.name;
            }
        }
        throw new Error(
            `Mapped join: column '${nameOrProperty}' not found on ${metadata.name}.`,
        );
    }

    private resolveColumnPropertyKey(
        metadata: OrmTableMetadata,
        nameOrProperty: string,
    ): string {
        for (const column of metadata.columns) {
            if (
                column.propertyKey === nameOrProperty ||
                column.options?.name === nameOrProperty
            ) {
                return column.propertyKey;
            }
        }
        throw new Error(
            `Mapped join: column '${nameOrProperty}' not found on ${metadata.name}.`,
        );
    }

    //#endregion

    /**
     * Compiles a `where` into one SQL condition per branch: an array-where
     * yields one entry per element (each element's fields ANDed together),
     * a single object yields at most one entry. Array semantics are OR
     * across branches, so callers taking the array form must combine the
     * returned conditions with `or(...)`; the single-object write paths
     * (update/delete/increment) get at most one condition either way.
     */
    protected buildWhereConditions<EntityType extends object>(
        table: object,
        where:
            | OrmFindOptionsWhere<EntityType>
            | OrmFindOptionsWhere<EntityType>[]
            | OrmPartialEntity<EntityType>
            | OrmPartialEntity<EntityType>[],
        metadata?: OrmTableMetadata,
    ): SQL[] {
        const conditions: SQL[] = [];
        const whereArray = Array.isArray(where) ? where : [where];
        for (const whereItem of whereArray) {
            const itemConditions: SQL[] = [];
            for (const [key, value] of Object.entries(whereItem)) {
                // `undefined` means "no condition for this key" — a common
                // pattern when assembling a where object from optional values.
                // Keep it a no-op regardless of the key.
                if (value === undefined) {
                    continue;
                }

                const column = (table as DrizzleTableLike)[key];
                if (column) {
                    const condition = this.buildConditionForValue(
                        column,
                        value,
                    );
                    if (condition) {
                        itemConditions.push(condition);
                    }
                    continue;
                }

                // Not a column. If it's a declared relation (and we have the
                // metadata to resolve it), compile a relation predicate into an
                // EXISTS correlated subquery — "rows where a related row
                // matches". Requires metadata, so it's available on the find /
                // count paths.
                const relation = metadata?.relations.find(
                    (candidate) => candidate.propertyKey === key,
                );
                if (relation && metadata) {
                    itemConditions.push(
                        this.buildRelationExists(
                            table,
                            metadata,
                            relation,
                            value as OrmFindOptionsWhere<object>,
                        ),
                    );
                    continue;
                }

                // Neither a column nor a resolvable relation — fail loud rather
                // than silently dropping the condition (which would return
                // confidently-wrong rows).
                throw new Error(
                    `Cannot filter by '${key}' on '${getTableName(table as Table)}': it is not a column or relation.`,
                );
            }
            if (itemConditions.length > 0) {
                conditions.push(
                    itemConditions.length === 1
                        ? itemConditions[0]
                        : and(...itemConditions)!,
                );
            }
        }

        return conditions;
    }

    /**
     * Compile a relation predicate (`where: { relation: { ...conditions } }`)
     * into an `EXISTS` correlated subquery against the related table, reusing
     * the same parent↔child correlation the mapped-join builder uses. The
     * nested conditions go back through `buildWhereConditions` with the target's
     * metadata, so column filters, operators, and further relation predicates
     * (multi-hop) all work inside.
     */
    private buildRelationExists(
        parentTable: object,
        parentMetadata: OrmTableMetadata,
        relation: OrmRelationMetadata,
        nestedWhere: OrmFindOptionsWhere<object>,
    ): SQL {
        const targetMetadata = ormRequireTable(relation.target());
        const childTable = this.schema[targetMetadata.name];
        if (!childTable) {
            throw new Error(
                `Table '${targetMetadata.name}' not found in schema`,
            );
        }

        const parentCols = parentTable as DrizzleTableLike;
        const childCols = childTable as DrizzleTableLike;

        let correlation: SQL;
        if (relation.type === 'many-to-one' || relation.type === 'one-to-one') {
            // The FK lives on the parent; correlate it to the target's
            // referenced column (its primary key unless overridden).
            const parentKey = this.resolveColumnPropertyKey(
                parentMetadata,
                relation.joinColumn,
            );
            const rawReferenced =
                parentMetadata.joinColumns?.[relation.propertyKey]
                    ?.referencedColumnName;
            const referencedKey = rawReferenced
                ? this.resolveColumnPropertyKey(targetMetadata, rawReferenced)
                : getPrimaryKeyPropertyKeys(targetMetadata)[0];
            correlation = eq(childCols[referencedKey]!, parentCols[parentKey]!);
        } else {
            // one-to-many: the FK lives on the target, via its inverse
            // many-to-one back to this entity.
            const inverse = targetMetadata.relations.find(
                (candidate) => candidate.propertyKey === relation.inverseSide,
            );
            if (
                !inverse ||
                (inverse.type !== 'many-to-one' &&
                    inverse.type !== 'one-to-one')
            ) {
                throw new Error(
                    `Cannot filter by relation '${relation.propertyKey}' on '${parentMetadata.name}': its one-to-many inverse '${relation.inverseSide}' is not a many-to-one on '${targetMetadata.name}'.`,
                );
            }
            const childKey = this.resolveColumnPropertyKey(
                targetMetadata,
                inverse.joinColumn,
            );
            // Honor the inverse many-to-one's referencedColumnName override
            // — the child FK may reference a non-PK parent column (e.g. a
            // unique uuid). Falling back to the parent PK unconditionally
            // correlated child.fk = parent.pk and matched zero rows. Same
            // resolution every sibling path (schema relations(), mapped
            // joins, the many-to-one branch above) already uses.
            const rawReferenced =
                targetMetadata.joinColumns?.[inverse.propertyKey]
                    ?.referencedColumnName;
            const parentKey = rawReferenced
                ? this.resolveColumnPropertyKey(parentMetadata, rawReferenced)
                : getPrimaryKeyPropertyKeys(parentMetadata)[0];
            correlation = eq(childCols[childKey]!, parentCols[parentKey]!);
        }

        const innerConditions = this.buildWhereConditions(
            childTable,
            nestedWhere,
            targetMetadata,
        );
        const predicate =
            innerConditions.length > 0
                ? and(correlation, ...innerConditions)!
                : correlation;

        return exists(
            this.db
                .select({ one: sql`1` })
                .from(childTable)
                .where(predicate),
        );
    }

    protected buildConditionForValue(
        column: Column,
        value: unknown,
    ): SQL | null {
        if (value === null) {
            return isNull(column);
        }

        if (value === undefined) {
            return null;
        }

        if (isOrmFilter(value)) {
            const filter = value as OrmFilter;

            switch (filter.type) {
                // eq/ne with a null value must compile to IS [NOT] NULL —
                // `= NULL`/`<> NULL` are never true under SQL three-valued
                // logic, silently matching zero rows. The bare-null where
                // value is already normalized this way; the explicit filter
                // forms (legal for nullable columns, and reachable whenever
                // a runtime variable happens to be null) get the same
                // treatment.
                case 'eq':
                    return filter.value === null
                        ? isNull(column)
                        : eq(column, filter.value);
                case 'ne':
                    return filter.value === null
                        ? isNotNull(column)
                        : ne(column, filter.value);
                case 'gt':
                    return gt(column, filter.value);
                case 'gte':
                    return gte(column, filter.value);
                case 'lt':
                    return lt(column, filter.value);
                case 'lte':
                    return lte(column, filter.value);
                case 'in':
                    return inArray(column, filter.value);
                case 'notIn':
                    return notInArray(column, filter.value);
                case 'between':
                    return between(column, filter.min, filter.max);
                case 'notBetween':
                    return notBetween(column, filter.min, filter.max);
                case 'like':
                    return like(column, filter.pattern);
                case 'notLike':
                    return notLike(column, filter.pattern);
                case 'isNull':
                    return isNull(column);
                case 'isNotNull':
                    return isNotNull(column);
                case 'exists':
                    return exists(filter.value);
                case 'notExists':
                    return notExists(filter.value);
                case 'not': {
                    const notCondition = this.buildConditionForValue(
                        column,
                        filter.value,
                    );
                    return notCondition ? not(notCondition) : null;
                }
                case 'and': {
                    const andConditions: SQL[] = [];
                    for (const subFilter of filter.value) {
                        const condition = this.buildConditionForValue(
                            column,
                            subFilter,
                        );
                        if (condition) {
                            andConditions.push(condition);
                        }
                    }
                    return andConditions.length > 0
                        ? and(...andConditions)!
                        : null;
                }
                case 'or': {
                    const orConditions: SQL[] = [];
                    for (const subFilter of filter.value) {
                        const condition = this.buildConditionForValue(
                            column,
                            subFilter,
                        );
                        if (condition) {
                            orConditions.push(condition);
                        }
                    }
                    return orConditions.length > 0
                        ? or(...orConditions)!
                        : null;
                }
                default:
                    // Exhaustive over the OrmFilter union: adding a new filter
                    // type without a case here is a compile error, instead of
                    // silently coercing it to an equality check.
                    return assertNever(filter);
            }
        }

        if (Array.isArray(value)) {
            return inArray(column, value);
        }

        return eq(column, value);
    }

    //#endregion
    //#region Private

    private async arithmeticUpdate<EntityType extends object>(
        metadata: OrmTableMetadata,
        conditions: OrmFindOptionsWhere<EntityType>,
        column: keyof EntityType & string,
        value: number,
        operator: '+' | '-',
        additionalSet?: Record<string, unknown>,
    ): Promise<OrmUpdateResult<EntityType>> {
        const table = this.schema[metadata.name];
        if (!table) {
            throw new Error(`Table '${metadata.name}' not found in schema`);
        }

        const tableColumn = this.getTableColumn(table, column);
        if (!tableColumn) {
            throw new Error(
                `Column '${column}' not found in table '${metadata.name}'`,
            );
        }

        const whereConditions = this.buildWhereConditions(table, conditions);
        if (whereConditions.length === 0) {
            return { affectedRows: 0, raw: null };
        }

        const setExpr =
            operator === '+'
                ? sql`${tableColumn} + ${value}`
                : sql`${tableColumn} - ${value}`;

        const result: any = await this.db
            .update(table)
            .set({ ...additionalSet, [column]: setExpr })
            .where(
                whereConditions.length === 1
                    ? whereConditions[0]
                    : and(...whereConditions)!,
            );

        return this.convertUpdateResult([result]);
    }

    //#endregion
}
