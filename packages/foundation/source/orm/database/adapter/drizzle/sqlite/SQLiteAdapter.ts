// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

import { and, or, sql, SQLWrapper, type SQL } from 'drizzle-orm';
import type {
    AnySQLiteTable,
    BaseSQLiteDatabase,
    SQLiteColumn,
    SQLiteTransaction,
} from 'drizzle-orm/sqlite-core';

import { numberClamp } from '@system-inc/base-common/number/Clamp';
import { TimeInterval } from '@system-inc/base-common/time/TimeInterval';
import {
    OrmTimeSeriesDefaultLimit,
    OrmTimeSeriesMaxLimit,
    OrmTimeSeriesOptions,
} from '../../../../interfaces/find/OrmTimeSeriesOptions';
import { OrmPartialEntity } from '../../../../interfaces/OrmPartialEntity';
import { OrmDeleteResult } from '../../../../interfaces/result/OrmDeleteResult';
import { OrmInsertResult } from '../../../../interfaces/result/OrmInsertResult';
import { OrmTimeSeriesResult } from '../../../../interfaces/result/OrmTimeSeriesResult';
import { OrmUpdateResult } from '../../../../interfaces/result/OrmUpdateResult';
import { getPrimaryKeyColumns } from '../../../../metadata/OrmPrimaryKeyInfo';
import { OrmTableMetadata } from '../../../../metadata/OrmTableMetadata';
import { OrmDatabaseTypeOfDialect } from '../../OrmDatabaseType';
import { DrizzleAdapterBase } from '../DrizzleAdapterBase';
import { getTimezoneOffsetSegments } from '../TimeSeriesTimezone';
import { DrizzleFullSchema } from '../types/DrizzleDefaultSchema';
import { DrizzleSchema } from '../types/DrizzleSchema';

export type SQLiteDb<SyncType extends 'sync' | 'async' = 'sync' | 'async'> =
    BaseSQLiteDatabase<
        SyncType,
        any,
        DrizzleFullSchema<AnySQLiteTable>,
        DrizzleSchema<AnySQLiteTable>
    >;

export type SQLiteTx = SQLiteTransaction<
    'sync' | 'async',
    any,
    DrizzleFullSchema<AnySQLiteTable>,
    DrizzleSchema<AnySQLiteTable>
>;

/**
 * SQLite dialect base. Concrete drivers (D1, Durable Objects, BetterSQLite)
 * extend this for their connection setup, transaction model, and result
 * conversion. Shared CRUD lives on `DrizzleAdapterBase`; only operations
 * that need the SQLite variable-limit batching, the `ON CONFLICT` upsert
 * syntax, or SQLite-specific `strftime`/`datetime` time bucketing live here.
 */
export abstract class SQLiteAdapter extends DrizzleAdapterBase {
    /**
     * Maximum number of SQL variables allowed in a single query.
     * Override in subclasses if different from default SQLite limit.
     */
    protected readonly maxSQLVariables: number = 999;

    constructor(
        readonly databaseType: OrmDatabaseTypeOfDialect<'sqlite'>,
        protected readonly db: SQLiteDb | SQLiteTx,
        protected readonly schema: DrizzleFullSchema<AnySQLiteTable>,
    ) {
        super();
    }

    async execute(query: SQLWrapper | string): Promise<any> {
        return this.db.all(query);
    }

    async executeRows<RowType = Record<string, unknown>>(
        query: SQLWrapper | string,
    ): Promise<RowType[]> {
        // SQLite's `all()` already resolves to the row array.
        return (await this.execute(query)) as RowType[];
    }

    async insert<EntityType extends object>(
        metadata: OrmTableMetadata,
        values: ReadonlyArray<OrmPartialEntity<EntityType>>,
    ): Promise<OrmInsertResult<EntityType>> {
        if (values.length === 0) {
            return { affectedRows: 0, raw: null };
        }

        const table = this.schema[metadata.name];
        const results = await this.executeBatched(
            values,
            async (batch) => {
                // Drizzle queries are thenable - they execute automatically when awaited
                return await this.db.insert(table).values(batch as any);
            },
            (item) => item as Record<string, any>,
            metadata, // Pass metadata for accurate column count
        );

        // If everything fit in one chunk, convert the single driver result.
        // Otherwise convert each chunk and aggregate — convertInsertResult
        // is per-driver-row (D1 reads `.meta.changes`, BetterSQLite reads
        // `.changes`, etc.), so passing it an array would crash.
        if (results.length === 1) {
            return this.convertInsertResult(results[0]);
        }

        let totalAffected = 0;
        let lastInsertedId: OrmInsertResult<EntityType>['insertedId'];
        for (const result of results) {
            const converted = this.convertInsertResult<EntityType>(result);
            totalAffected += converted.affectedRows ?? 0;
            if (converted.insertedId !== undefined) {
                lastInsertedId = converted.insertedId;
            }
        }
        return {
            affectedRows: totalAffected,
            raw: results,
            insertedId: lastInsertedId,
        };
    }

    async updateBatch<EntityType extends object>(
        metadata: OrmTableMetadata,
        operations: ReadonlyArray<{
            conditions: OrmPartialEntity<EntityType>;
            values: OrmPartialEntity<EntityType>;
        }>,
    ): Promise<OrmUpdateResult<EntityType>> {
        if (operations.length === 0) {
            return { affectedRows: 0, raw: null };
        }

        const table = this.schema[metadata.name];
        if (!table) {
            throw new Error(`Table '${metadata.name}' not found in schema`);
        }

        // Group updates by identical values to minimize queries (no-op
        // empty-values operations are skipped — see groupUpdateOperations).
        const updateGroups = this.groupUpdateOperations(operations);

        // Execute batched updates
        const rawUpdates: any[] = [];
        for (const { values, conditions } of updateGroups.values()) {
            // Use executeBatched to handle conditions in safe batch sizes
            const batchResults = await this.executeBatched(
                conditions,
                async (batchConditions) => {
                    // Build OR conditions for this batch
                    const allConditions: SQL[] = [];
                    for (const condition of batchConditions) {
                        const whereConditions = this.buildWhereConditions(
                            table,
                            condition,
                        );
                        if (whereConditions.length > 0) {
                            allConditions.push(
                                whereConditions.length === 1
                                    ? whereConditions[0]
                                    : and(...whereConditions)!,
                            );
                        }
                    }

                    if (allConditions.length > 0) {
                        const result: any = await this.db
                            .update(table)
                            .set(values)
                            .where(
                                allConditions.length === 1
                                    ? allConditions[0]
                                    : sql`(${allConditions.map((c) => sql`(${c})`).reduce((a, b) => sql`${a} OR ${b}`)})`,
                            );

                        return result;
                    }
                    return null;
                },
                // getSampleRecord: combine values and conditions for variable counting
                (condition) => ({ ...values, ...condition }),
                metadata,
            );

            // Add non-null results to rawUpdates
            for (const result of batchResults) {
                if (result) {
                    rawUpdates.push(result);
                }
            }
        }

        return this.convertUpdateResult(rawUpdates);
    }

    async upsertBatch<EntityType extends object>(
        metadata: OrmTableMetadata,
        operations: ReadonlyArray<{
            conditions: OrmPartialEntity<EntityType>;
            values: OrmPartialEntity<EntityType>;
        }>,
    ): Promise<OrmInsertResult<EntityType>> {
        const table = this.schema[metadata.name];
        if (!table) {
            throw new Error(`Table '${metadata.name}' not found in schema`);
        }

        if (operations.length === 0) {
            return { affectedRows: 0, raw: null };
        }

        // Each operation is its own statement, so the per-statement variable
        // limit isn't a concern here. We loop one row at a time.
        const allResults: any[] = [];
        for (const { conditions, values } of operations) {
            const result: any = await this.buildBatchUpsertQuery(
                this.db,
                metadata,
                table,
                conditions,
                values,
            );
            if (result) {
                allResults.push(result);
            }
        }

        // Rows-addressed normalization (see MySqlAdapter.upsertBatch):
        // the DO NOTHING fallback for key-only rows reports 0 changes for
        // an already-present row, but the row IS in the requested state.
        return {
            ...this.convertUpsertResult(allResults),
            affectedRows: operations.length,
        };
    }

    protected buildBatchUpsertQuery(
        dbOrTx: any,
        metadata: OrmTableMetadata,
        table: object,
        conditions: OrmPartialEntity<object>,
        values: OrmPartialEntity<object>,
    ): any {
        // Derive PK columns from the table's primary-key info so single,
        // composite, and auto serial/uuid keys are all handled. A table-level
        // composite PK (@OrmPrimaryKey) doesn't set per-column `primaryKey`
        // options, so filtering columns by that option misses junction tables —
        // which then fall through to a plain insert and collide on re-upsert.
        const primaryKeyPropertyKeys = getPrimaryKeyColumns(
            metadata.primaryKey,
        );
        const primaryKeyColumns = primaryKeyPropertyKeys
            .map((key) => this.getTableColumn(table, key))
            .filter(
                (c): c is NonNullable<typeof c> => c !== undefined,
            ) as SQLiteColumn[];

        const insertRow = { ...conditions, ...values };

        // Create-date columns belong in the INSERT values but never in the
        // conflict-update SET: upserting an existing row must not rewrite
        // when it was created (it also breaks the createdAt === updatedAt
        // "never updated" sentinel).
        const createDateColumns = new Set(metadata.dateColumns['create']);

        const updateSet: Record<string, SQL> = {};
        for (const col of Object.keys(values)) {
            if (createDateColumns.has(col)) {
                continue;
            }
            const column = this.getTableColumn(table, col);
            if (column) {
                // `excluded.<x>` must reference the DB column name, not the
                // entity property key — otherwise a column with a custom
                // `name:` (e.g. eventTime -> event_time) yields
                // "no such column: excluded.eventTime". The set key stays the
                // property key; Drizzle maps it to the column.
                updateSet[col] = sql`excluded.${sql.identifier(column.name)}`;
            }
        }

        const hasPrimaryKey = primaryKeyPropertyKeys.some(
            (key) => key in insertRow,
        );

        // Without a resolvable primary key in the row there is no conflict
        // target, so an upsert would silently become a plain insert — creating
        // duplicates or throwing a confusing constraint error instead of the
        // expected insert-or-update. Fail loud; the caller wants insert() if
        // that's the intent.
        if (primaryKeyPropertyKeys.length === 0) {
            throw new Error(
                `Cannot upsert '${metadata.name}': it has no primary key to detect conflicts on. Use insert() instead.`,
            );
        }
        if (!hasPrimaryKey || primaryKeyColumns.length === 0) {
            throw new Error(
                `Cannot upsert '${metadata.name}': the primary key column(s) ${primaryKeyPropertyKeys.join(', ')} must be set on the row to detect a conflict.`,
            );
        }

        if (Object.keys(updateSet).length > 0) {
            return dbOrTx.insert(table).values(insertRow).onConflictDoUpdate({
                target: primaryKeyColumns,
                set: updateSet,
            });
        }
        // PK present but no non-key columns to update (e.g. a pure junction
        // row whose every column is part of the composite key). Insert if
        // new, no-op if the PK already exists — keeping upsert idempotent
        // instead of throwing a PK-constraint violation.
        return dbOrTx
            .insert(table)
            .values(insertRow)
            .onConflictDoNothing({ target: primaryKeyColumns });
    }

    async deleteBatch<EntityType extends object>(
        metadata: OrmTableMetadata,
        conditions: ReadonlyArray<OrmPartialEntity<EntityType>>,
    ): Promise<OrmDeleteResult<EntityType>> {
        const table = this.schema[metadata.name];
        if (!table) {
            throw new Error(`Table '${metadata.name}' not found in schema`);
        }

        if (conditions.length === 0) {
            return { affectedRows: 0, raw: null };
        }

        // Use executeBatched to handle conditions in safe batch sizes
        const batchResults = await this.executeBatched(
            conditions,
            async (batchConditions) => {
                // Build OR conditions for this batch
                const allConditions: SQL[] = [];
                for (const condition of batchConditions) {
                    const whereConditions = this.buildWhereConditions(
                        table,
                        condition,
                    );
                    if (whereConditions.length > 0) {
                        allConditions.push(
                            whereConditions.length === 1
                                ? whereConditions[0]
                                : and(...whereConditions)!,
                        );
                    }
                }

                if (allConditions.length > 0) {
                    const result: any = await this.db
                        .delete(table)
                        .where(
                            allConditions.length === 1
                                ? allConditions[0]
                                : sql`(${allConditions.map((c) => sql`(${c})`).reduce((a, b) => sql`${a} OR ${b}`)})`,
                        );
                    return result;
                }
                return null;
            },
            (condition) => condition as Record<string, any>,
            metadata,
        );

        // Filter out null results and combine
        const validResults = batchResults.filter((r) => r !== null);

        if (validResults.length === 0) {
            return { affectedRows: 0, raw: null };
        } else if (validResults.length === 1) {
            return this.convertDeleteResult(validResults[0]);
        } else {
            // Aggregate multiple delete results
            let totalAffected = 0;
            for (const result of validResults) {
                const converted = this.convertDeleteResult(result);
                totalAffected += converted.affectedRows || 0;
            }
            return {
                affectedRows: totalAffected,
                raw: validResults,
            };
        }
    }

    async dispose(): Promise<void> {}

    /**
     * Builds a time-bucketed histogram with conditional counts using direct aggregation.
     * - Uses GROUP BY on time buckets directly from table data.
     * - Much faster than CTE + JOIN approach for large datasets.
     * - Returns OrmTimeSeriesResult format.
     */
    async timeSeries(
        tableName: string,
        column: string,
        options: OrmTimeSeriesOptions<object>,
    ): Promise<OrmTimeSeriesResult[]> {
        const {
            startAtUtc: startEpochSec,
            endAtUtc: endEpochSec,
            interval,
            timeColIsEpochSec = false,
            where,
            filters,
            timeZone,
        } = options;
        const table = this.schema[tableName];
        const tableColumn = this.getTableColumn(table, column);
        if (!tableColumn) {
            throw new Error(
                `Column '${column}' not found in table '${tableName}'`,
            );
        }

        const limit = numberClamp(
            options.limit ?? OrmTimeSeriesDefaultLimit,
            1,
            OrmTimeSeriesMaxLimit,
        );
        const offset = Math.max(0, options.offset ?? 0);

        // Timezone offset segments across the range — one per side of any
        // DST transition. A single offset frozen at range start bucketed
        // post-transition rows into the wrong local day/hour.
        const tzSegments = timeZone
            ? getTimezoneOffsetSegments(timeZone, startEpochSec, endEpochSec)
            : [];
        const tzOffsetMinutes = tzSegments[0]?.offsetMinutes ?? 0;

        // SQLite modifier for applying timezone offset
        const tzModifier =
            tzOffsetMinutes !== 0
                ? `, '${tzOffsetMinutes >= 0 ? '-' : '+'}${Math.abs(tzOffsetMinutes)} minutes'`
                : '';

        // Default filters to empty array if not provided
        const actualFilters = filters ?? [];

        // Build column expression with timezone adjustment for bucketing.
        // Multi-segment ranges shift per ROW via a CASE on the raw column
        // (keeping GROUP BY / DISTINCT in one query); single-segment
        // ranges keep the cheaper constant modifier.
        let adjustedColumn: SQL | typeof tableColumn;
        if (tzSegments.length > 1) {
            const rowEpoch = timeColIsEpochSec
                ? sql`${tableColumn}`
                : sql`strftime('%s', ${tableColumn})`;
            const offsetCase = sql.join(
                tzSegments
                    .slice(0, -1)
                    .map(
                        (segment) =>
                            sql`WHEN ${rowEpoch} < ${segment.endEpochSec} THEN ${segment.offsetMinutes}`,
                    ),
                sql.raw(' '),
            );
            const lastOffset = tzSegments[tzSegments.length - 1]!.offsetMinutes;
            adjustedColumn = sql`datetime(${rowEpoch} - (CASE ${offsetCase} ELSE ${lastOffset} END) * 60, 'unixepoch')`;
        } else {
            adjustedColumn = timeColIsEpochSec
                ? tzOffsetMinutes !== 0
                    ? sql`datetime(${tableColumn}, 'unixepoch'${sql.raw(tzModifier)})`
                    : sql`datetime(${tableColumn}, 'unixepoch')`
                : tzOffsetMinutes !== 0
                  ? sql`datetime(${tableColumn}${sql.raw(tzModifier)})`
                  : tableColumn;
        }

        // Build time range filter (sargable condition for index usage)
        // For datetime strings, we need to use strftime to get ISO-8601 format with 'Z' for proper comparison
        const timeRangeFilter = timeColIsEpochSec
            ? sql`${tableColumn} >= ${startEpochSec} AND ${tableColumn} < ${endEpochSec}`
            : sql`${tableColumn} >= strftime('%Y-%m-%dT%H:%M:%S.000Z', datetime(${startEpochSec}, 'unixepoch')) AND ${tableColumn} < strftime('%Y-%m-%dT%H:%M:%S.000Z', datetime(${endEpochSec}, 'unixepoch'))`;

        // Build WHERE clause (array where = OR of branches)
        let baseWhere = sql``;
        if (where) {
            const whereConditions = this.buildWhereConditions(table, where);
            if (whereConditions.length > 0) {
                const whereExpr =
                    whereConditions.length === 1
                        ? whereConditions[0]
                        : or(...whereConditions)!;
                baseWhere = sql`AND (${whereExpr})`;
            }
        }

        // Build the bucket expression based on interval
        let bucketExpr: SQL;
        const utcSuffix = tzOffsetMinutes === 0 ? '.000Z' : '';

        switch (interval) {
            case TimeInterval.Minute:
                bucketExpr = sql`strftime('%Y-%m-%dT%H:%M:00${sql.raw(utcSuffix)}', ${adjustedColumn})`;
                break;
            case TimeInterval.Hour:
                bucketExpr = sql`strftime('%Y-%m-%dT%H:00:00${sql.raw(utcSuffix)}', ${adjustedColumn})`;
                break;
            case TimeInterval.HourOfDay:
                bucketExpr = sql`CAST(strftime('%H', ${adjustedColumn}) AS TEXT)`;
                break;
            case TimeInterval.Day:
                bucketExpr = sql`strftime('%Y-%m-%d', ${adjustedColumn})`;
                break;
            case TimeInterval.DayOfWeek:
                bucketExpr = sql`CASE CAST(strftime('%w', ${adjustedColumn}) AS INTEGER)
                    WHEN 0 THEN 'Sunday'
                    WHEN 1 THEN 'Monday'
                    WHEN 2 THEN 'Tuesday'
                    WHEN 3 THEN 'Wednesday'
                    WHEN 4 THEN 'Thursday'
                    WHEN 5 THEN 'Friday'
                    WHEN 6 THEN 'Saturday'
                END`;
                break;
            case TimeInterval.Week:
                // ISO week via the Thursday-shift idiom ('-3 days',
                // 'weekday 4' lands on the ISO week's Thursday), portable
                // to every bundled SQLite (%G/%V need 3.46+, D1/DO/
                // better-sqlite3 ship older). The previous '%Y-W%W'
                // (Monday-start, ZERO-based, including invalid W00) never
                // agreed with MySQL's ISO labels for the same instants.
                bucketExpr = sql`printf('%s-W%02d', strftime('%Y', ${adjustedColumn}, '-3 days', 'weekday 4'), (CAST(strftime('%j', ${adjustedColumn}, '-3 days', 'weekday 4') AS INTEGER) - 1) / 7 + 1)`;
                break;
            case TimeInterval.WeekOfYear:
                bucketExpr = sql`printf('%02d', (CAST(strftime('%j', ${adjustedColumn}, '-3 days', 'weekday 4') AS INTEGER) - 1) / 7 + 1)`;
                break;
            case TimeInterval.DayOfMonth:
                bucketExpr = sql`CAST(strftime('%d', ${adjustedColumn}) AS TEXT)`;
                break;
            case TimeInterval.Month:
                bucketExpr = sql`strftime('%Y-%m', ${adjustedColumn})`;
                break;
            case TimeInterval.MonthOfYear:
                bucketExpr = sql`CAST(strftime('%m', ${adjustedColumn}) AS TEXT)`;
                break;
            case TimeInterval.Quarter:
                bucketExpr = sql`(strftime('%Y', ${adjustedColumn}) || '-Q' || ((CAST(strftime('%m', ${adjustedColumn}) AS INTEGER) - 1) / 3 + 1))`;
                break;
            case TimeInterval.Year:
                bucketExpr = sql`CAST(strftime('%Y', ${adjustedColumn}) AS TEXT)`;
                break;
            default:
                throw new Error(`Unsupported interval: ${interval}`);
        }

        // Dynamic SUM(CASE WHEN ...) columns for filters
        const dynCols = actualFilters.map((f) => {
            const conditions = this.buildWhereConditions(table, f.condition);
            // Combine multiple conditions with OR (array in filter means "match any")
            const conditionExpr =
                conditions.length === 0
                    ? sql`0` // No conditions means never match
                    : conditions.length === 1
                      ? conditions[0]
                      : or(...conditions)!;
            return sql`, SUM(CASE WHEN ${conditionExpr} THEN 1 ELSE 0 END) AS ${sql.raw(quoteIdent(f.key))}`;
        });

        // Combine all dynamic columns into a single SQL fragment
        const dynColsFragment =
            dynCols.length > 0
                ? dynCols.reduce((acc, col) => sql`${acc}${col}`)
                : sql``;

        // COUNT(*) per bucket, or COUNT(DISTINCT <col>) when requested
        const distinctColumnName = options.distinctColumn;
        let countExpr: SQL = sql`COUNT(*)`;
        if (distinctColumnName) {
            const distinctColumn = this.getTableColumn(
                table,
                distinctColumnName,
            );
            if (!distinctColumn) {
                throw new Error(
                    `Column '${distinctColumnName}' not found in table '${tableName}'`,
                );
            }
            countExpr = sql`COUNT(DISTINCT ${distinctColumn})`;
        }

        // Build the query using direct aggregation
        const query = sql`
        SELECT
          ${bucketExpr} AS bucket,
          ${countExpr} AS total${dynColsFragment}
        FROM ${table}
        WHERE ${timeRangeFilter}
          ${baseWhere}
        GROUP BY bucket
        ORDER BY bucket
        LIMIT ${limit} OFFSET ${offset};
      `;

        // Execute query and get raw rows
        const rows: any[] = await this.db.all(query);

        // Transform to OrmTimeSeriesResult format
        return rows.map((row) => {
            const total = Number(row.total ?? 0);
            const filterKeys = actualFilters.map((f) => ({
                key: f.key,
                count: Number(row[f.key] ?? 0),
            }));

            return {
                bucket: row.bucket as string,
                filterKeys,
                total,
            };
        });
    }
}

function quoteIdent(key: string): string {
    // Escape embedded double quotes, then wrap the whole thing
    return `"${key.replace(/"/g, '""')}"`;
}
