// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
import { and, or, sql, SQLWrapper, type SQL } from 'drizzle-orm';
import type {
    AnyMySqlTable,
    MySqlDatabase,
    MySqlTransaction,
} from 'drizzle-orm/mysql-core';

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
import { OrmDatabaseImpl } from '../../../internal/OrmDatabaseImpl';
import { OrmTransactionImpl } from '../../../internal/OrmTransactionImpl';
import { OrmTransaction } from '../../../transaction/OrmTransaction';
import { OrmAdapterOptions } from '../../OrmAdapterOptions';
import { OrmDatabaseTypeOfDialect } from '../../OrmDatabaseType';
import { DrizzleAdapterBase } from '../DrizzleAdapterBase';
import { getTimezoneOffsetSegments } from '../TimeSeriesTimezone';
import { DrizzleFullSchema } from '../types/DrizzleDefaultSchema';
import { DrizzleSchema } from '../types/DrizzleSchema';

export type MySqlDb = MySqlDatabase<
    any,
    any,
    DrizzleFullSchema<AnyMySqlTable>,
    DrizzleSchema<AnyMySqlTable>
>;

export type MySqlTx = MySqlTransaction<
    any,
    any,
    DrizzleFullSchema<AnyMySqlTable>,
    DrizzleSchema<AnyMySqlTable>
>;

/**
 * MySQL dialect adapter. Driver-specific connection construction (e.g.
 * PlanetScale) lives in the corresponding provider; this class just takes
 * a `MySqlDatabase` instance and runs queries against it. Shared CRUD
 * lives on `DrizzleAdapterBase`; the methods here are the ones with
 * dialect-specific semantics (`ON DUPLICATE KEY UPDATE` upsert) or
 * dialect-specific batching strategies (MySQL's 65K placeholder limit is
 * generous enough that we don't chunk).
 */
export class MySqlAdapter extends DrizzleAdapterBase {
    /**
     * MySQL allows up to 65,535 placeholders per prepared statement.
     * Stay well below that ceiling.
     */
    protected readonly maxSQLVariables: number = 60000;

    constructor(
        readonly databaseType: OrmDatabaseTypeOfDialect<'mysql'>,
        protected readonly db: MySqlDb | MySqlTx,
        protected readonly schema: DrizzleFullSchema<AnyMySqlTable>,
        private readonly options: OrmAdapterOptions,
    ) {
        super();
    }

    execute(query: SQLWrapper | string): Promise<any> {
        return this.db.execute(query);
    }

    async executeRows<RowType = Record<string, unknown>>(
        query: SQLWrapper | string,
    ): Promise<RowType[]> {
        const result = await this.execute(query);
        // The PlanetScale driver resolves to an ExecutedQuery whose rows
        // live under `.rows`; normalize here so no caller ever branches
        // on the driver shape (a driver resolving to the array directly
        // passes through).
        if (Array.isArray(result)) {
            return result as RowType[];
        }
        return (result?.rows ?? []) as RowType[];
    }

    async transaction<T>(
        context: OrmDatabaseImpl,
        callback: (tx: OrmTransaction) => Promise<T>,
    ): Promise<T> {
        let txContext: OrmTransactionImpl | undefined;
        try {
            const txResult = await this.db.transaction(async (tx) => {
                txContext = new OrmTransactionImpl(
                    context.configuration,
                    new MySqlAdapter(
                        this.databaseType,
                        tx,
                        this.schema,
                        this.options,
                    ),
                );
                return await callback(txContext);
            });
            await txContext?.runOnSuccess();
            return txResult;
        } catch (error) {
            await txContext?.runOnFailure();
            throw error;
        }
    }

    async insert<EntityType extends object>(
        metadata: OrmTableMetadata,
        values: ReadonlyArray<OrmPartialEntity<EntityType>>,
    ): Promise<OrmInsertResult<EntityType>> {
        if (values.length === 0) {
            return { affectedRows: 0, raw: null };
        }
        const result = await this.db
            .insert(this.schema[metadata.name])
            .values(values as any);
        return this.convertInsertResult(result);
    }

    async updateBatch<EntityType extends object>(
        metadata: OrmTableMetadata,
        operations: ReadonlyArray<{
            conditions: OrmPartialEntity<EntityType>;
            values: OrmPartialEntity<EntityType>;
        }>,
    ): Promise<OrmUpdateResult<EntityType>> {
        const table = this.schema[metadata.name];
        if (!table) {
            throw new Error(`Table '${metadata.name}' not found in schema`);
        }

        // Group updates by identical values to minimize queries (no-op
        // empty-values operations are skipped — see groupUpdateOperations).
        const updateGroups = this.groupUpdateOperations(operations);

        const rawResults: any[] = [];
        for (const { values, conditions } of updateGroups.values()) {
            // Build OR conditions for all items in this group
            const allConditions: SQL[] = [];
            for (const condition of conditions) {
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
                const result = await this.db
                    .update(table)
                    .set(values)
                    .where(
                        allConditions.length === 1
                            ? allConditions[0]
                            : sql`(${allConditions.map((c) => sql`(${c})`).reduce((a, b) => sql`${a} OR ${b}`)})`,
                    );

                rawResults.push(result);
            }
        }

        return this.convertUpdateResult(rawResults);
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

        // Group upserts by the columns being updated to batch them
        const upsertGroups = new Map<
            string,
            {
                updateColumns: Set<string>;
                rows: OrmPartialEntity<EntityType>[];
            }
        >();

        // Create-date columns belong in the INSERT values but never in the duplicate-key SET:
        // upserting an existing row must not rewrite when it was created, and stamping it again
        // would break the `createdAt === updatedAt` "never updated" sentinel. This method builds
        // its SET directly (it does not go through buildBatchUpsertQuery), so it must filter here.
        const createDateColumns = new Set(metadata.dateColumns['create']);

        for (const { conditions, values } of operations) {
            // The row to insert includes both conditions and values.
            // MySQL's ON DUPLICATE KEY UPDATE automatically uses any unique
            // constraint (including primary keys), so we don't specify the
            // conflict target explicitly.
            const insertRow = { ...conditions, ...values };

            const updateColumns = Object.keys(values).filter(
                (column) => !createDateColumns.has(column),
            );
            const updateKey = updateColumns.sort().join(',');

            const group = upsertGroups.get(updateKey);
            if (group) {
                group.rows.push(insertRow);
            } else {
                upsertGroups.set(updateKey, {
                    updateColumns: new Set(updateColumns),
                    rows: [insertRow],
                });
            }
        }

        const rawResults: any[] = [];
        for (const { updateColumns, rows } of upsertGroups.values()) {
            const updateSet: Record<string, SQL> = {};

            for (const col of updateColumns) {
                const column = this.getTableColumn(table, col);
                if (column) {
                    // Use sql.raw to reference the VALUES() function in MySQL
                    updateSet[col] = sql`VALUES(${column})`;
                }
            }

            if (Object.keys(updateSet).length > 0) {
                const result = await this.db
                    .insert(table)
                    .values(rows)
                    .onDuplicateKeyUpdate({
                        set: updateSet,
                    });
                rawResults.push(result);
            } else {
                // No non-key columns to update (e.g. a pure junction row whose
                // every column is part of the key). MySQL's ON DUPLICATE KEY
                // UPDATE requires at least one assignment, so do a no-op (set a
                // key column to itself) to keep upsert idempotent instead of
                // throwing a duplicate-key error on an existing row.
                const pkKey = getPrimaryKeyColumns(metadata.primaryKey).find(
                    (key) => this.getTableColumn(table, key) !== undefined,
                );
                const pkColumn = pkKey
                    ? this.getTableColumn(table, pkKey)
                    : undefined;
                const result =
                    pkKey && pkColumn
                        ? await this.db
                              .insert(table)
                              .values(rows)
                              .onDuplicateKeyUpdate({
                                  set: { [pkKey]: sql`${pkColumn}` },
                              })
                        : // No PK to conflict on — plain insert.
                          await this.db.insert(table).values(rows);
                rawResults.push(result);
            }
        }

        // Normalize to rows-addressed: each upsert operation targets
        // exactly one row, which exists in the requested state afterward
        // — MySQL's 0/1/2-per-row encoding never reaches callers, and
        // portable accounting (affectedRows === ops.length) holds on
        // every dialect.
        return {
            ...this.convertUpsertResult(rawResults),
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
        const insertRow = { ...conditions, ...values };
        const updateSet: Record<string, SQL> = {};

        // Create-date columns belong in the INSERT values but never in
        // the duplicate-key SET: upserting an existing row must not
        // rewrite when it was created (it also breaks the createdAt ===
        // updatedAt "never updated" sentinel).
        const createDateColumns = new Set(metadata.dateColumns['create']);

        for (const col of Object.keys(values)) {
            if (createDateColumns.has(col)) {
                continue;
            }
            const column = this.getTableColumn(table, col);
            if (column) {
                // Use VALUES() to reference the insert-attempted value
                updateSet[col] = sql`VALUES(${column})`;
            }
        }

        if (Object.keys(updateSet).length > 0) {
            return dbOrTx
                .insert(table)
                .values(insertRow)
                .onDuplicateKeyUpdate({ set: updateSet });
        } else {
            return dbOrTx.insert(table).values(insertRow);
        }
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

        // Build OR conditions for all items to delete in one query
        const allConditions: SQL[] = [];
        for (const condition of conditions) {
            const whereConditions = this.buildWhereConditions(table, condition);
            if (whereConditions.length > 0) {
                allConditions.push(
                    whereConditions.length === 1
                        ? whereConditions[0]
                        : and(...whereConditions)!,
                );
            }
        }

        if (allConditions.length === 0) {
            return { affectedRows: 0, raw: null };
        }

        const result = await this.db
            .delete(table)
            .where(
                allConditions.length === 1
                    ? allConditions[0]
                    : sql`(${allConditions.map((c) => sql`(${c})`).reduce((a, b) => sql`${a} OR ${b}`)})`,
            );

        return this.convertDeleteResult(result);
    }

    async dispose(): Promise<void> {
        return Promise.resolve();
    }

    /**
     * Builds a time-bucketed histogram with optional conditional counts,
     * using MySQL date functions. Mirrors the SQLite adapter's behavior
     * with `DATE_FORMAT`/`FROM_UNIXTIME` in place of `strftime`. Supports
     * `COUNT(DISTINCT <column>)` per bucket via `options.distinctColumn`.
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
        if (!table) {
            throw new Error(`Table '${tableName}' not found in schema`);
        }
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
        const actualFilters = filters ?? [];

        // Timezone offset segments across the range — one per side of any
        // DST transition. A single offset frozen at range start bucketed
        // post-transition rows into the wrong local day/hour.
        const tzSegments = timeZone
            ? getTimezoneOffsetSegments(timeZone, startEpochSec, endEpochSec)
            : [];
        const tzOffsetMinutes = tzSegments[0]?.offsetMinutes ?? 0;

        // Time column, optionally converted from epoch seconds, then shifted
        // into the requested timezone for bucketing. Multi-segment ranges
        // shift per ROW via a CASE on the raw column, keeping GROUP BY and
        // DISTINCT in one query.
        const baseColumn = timeColIsEpochSec
            ? sql`FROM_UNIXTIME(${tableColumn})`
            : sql`${tableColumn}`;
        let adjustedColumn: SQL;
        if (tzSegments.length > 1) {
            const rowEpoch = timeColIsEpochSec
                ? sql`${tableColumn}`
                : sql`UNIX_TIMESTAMP(${tableColumn})`;
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
            adjustedColumn = sql`DATE_ADD(${baseColumn}, INTERVAL -(CASE ${offsetCase} ELSE ${lastOffset} END) MINUTE)`;
        } else {
            adjustedColumn =
                tzOffsetMinutes !== 0
                    ? sql`DATE_ADD(${baseColumn}, INTERVAL ${sql.raw(String(-tzOffsetMinutes))} MINUTE)`
                    : baseColumn;
        }

        // Sargable time-range predicate (keeps the index usable)
        const timeRangeFilter = timeColIsEpochSec
            ? sql`${tableColumn} >= ${startEpochSec} AND ${tableColumn} < ${endEpochSec}`
            : sql`${tableColumn} >= FROM_UNIXTIME(${startEpochSec}) AND ${tableColumn} < FROM_UNIXTIME(${endEpochSec})`;

        // Base WHERE filter applied to all counts (array where = OR of branches)
        let baseWhere = sql``;
        if (where) {
            const whereConditions = this.buildWhereConditions(table, where);
            const whereExpr =
                whereConditions.length === 1
                    ? whereConditions[0]
                    : or(...whereConditions);
            if (whereExpr) {
                baseWhere = sql`AND (${whereExpr})`;
            }
        }

        // 'Z' suffix only when bucketing in UTC (matches the SQLite adapter)
        // '.000Z' matches the SQLite adapter's Minute/Hour label format
        // exactly — the bare 'Z' variant produced bucket keys that never
        // string-matched SQLite's for the same instant.
        const utcSuffix = tzOffsetMinutes === 0 ? '.000Z' : '';
        let bucketExpr: SQL;
        switch (interval) {
            case TimeInterval.Minute:
                bucketExpr = sql`DATE_FORMAT(${adjustedColumn}, ${'%Y-%m-%dT%H:%i:00' + utcSuffix})`;
                break;
            case TimeInterval.Hour:
                bucketExpr = sql`DATE_FORMAT(${adjustedColumn}, ${'%Y-%m-%dT%H:00:00' + utcSuffix})`;
                break;
            case TimeInterval.HourOfDay:
                bucketExpr = sql`LPAD(HOUR(${adjustedColumn}), 2, '0')`;
                break;
            case TimeInterval.Day:
                bucketExpr = sql`DATE_FORMAT(${adjustedColumn}, ${'%Y-%m-%d'})`;
                break;
            case TimeInterval.DayOfWeek:
                bucketExpr = sql`CASE DAYOFWEEK(${adjustedColumn}) - 1
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
                // ISO year-week directly: %x is the ISO week-numbering year
                // (which differs from YEAR() at year boundaries), %v the
                // ISO week 01-53. The previous flat +3-day shift pushed
                // Fri/Sat/Sun rows into the NEXT week's bucket and could
                // emit impossible labels like 2027-W53.
                bucketExpr = sql`DATE_FORMAT(${adjustedColumn}, ${'%x-W%v'})`;
                break;
            case TimeInterval.WeekOfYear:
                bucketExpr = sql`LPAD(WEEK(${adjustedColumn}, 3), 2, '0')`;
                break;
            case TimeInterval.DayOfMonth:
                bucketExpr = sql`LPAD(DAY(${adjustedColumn}), 2, '0')`;
                break;
            case TimeInterval.Month:
                bucketExpr = sql`DATE_FORMAT(${adjustedColumn}, ${'%Y-%m'})`;
                break;
            case TimeInterval.MonthOfYear:
                bucketExpr = sql`LPAD(MONTH(${adjustedColumn}), 2, '0')`;
                break;
            case TimeInterval.Quarter:
                bucketExpr = sql`CONCAT(YEAR(${adjustedColumn}), '-Q', QUARTER(${adjustedColumn}))`;
                break;
            case TimeInterval.Year:
                bucketExpr = sql`CAST(YEAR(${adjustedColumn}) AS CHAR)`;
                break;
            default:
                throw new Error(`Unsupported interval: ${interval}`);
        }

        // Dynamic SUM(CASE WHEN ...) columns for conditional filter counts
        const dynCols = actualFilters.map((f) => {
            const conditions = this.buildWhereConditions(table, f.condition);
            const conditionExpr =
                conditions.length === 0
                    ? sql`0`
                    : conditions.length === 1
                      ? conditions[0]
                      : (or(...conditions) ?? sql`0`);
            return sql`, SUM(CASE WHEN ${conditionExpr} THEN 1 ELSE 0 END) AS ${sql.raw(quoteIdent(f.key))}`;
        });
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

        // limit/offset are clamped integers; inline them (Vitess is finicky
        // about bound parameters in LIMIT/OFFSET).
        const query = sql`
        SELECT
          ${bucketExpr} AS bucket,
          ${countExpr} AS total${dynColsFragment}
        FROM ${table}
        WHERE ${timeRangeFilter}
          ${baseWhere}
        GROUP BY bucket
        ORDER BY bucket
        LIMIT ${sql.raw(String(limit))} OFFSET ${sql.raw(String(offset))}`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows = await this.executeRows<any>(query);

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

    //#region Result conversion

    protected convertInsertResult<EntityType extends object>(
        driverResult: any,
    ): OrmInsertResult<EntityType> {
        return {
            affectedRows: driverResult.rowsAffected,
            raw: driverResult.statement,
            insertedId: driverResult.insertId,
        };
    }

    protected convertUpdateResult<EntityType extends object>(
        driverResults: any[],
    ): OrmUpdateResult<EntityType> {
        let total = 0;
        for (const result of driverResults) {
            total += result.rowsAffected;
        }
        return { affectedRows: total, raw: null };
    }

    protected convertUpsertResult<EntityType extends object>(
        driverResults: any[],
    ): OrmInsertResult<EntityType> {
        // Raw driver sums (MySQL's ON DUPLICATE KEY encodes 1 = inserted,
        // 2 = updated, 0 = matched-but-identical, and one grouped result
        // can cover many rows) — the upsert entry points normalize
        // affectedRows to rows-addressed where the operation count is
        // known.
        let total = 0;
        let lastInsertId: string | undefined;
        for (const result of driverResults) {
            total += result.rowsAffected;
            if (result.insertId) {
                lastInsertId = result.insertId;
            }
        }
        return {
            affectedRows: total,
            raw: null,
            insertedId: lastInsertId,
        };
    }

    protected convertDeleteResult<EntityType extends object>(
        driverResult: any,
    ): OrmDeleteResult<EntityType> {
        return {
            affectedRows: driverResult.rowsAffected,
            raw: null,
        };
    }

    //#endregion
}

/**
 * Quotes a MySQL identifier (e.g. a filter alias), escaping embedded
 * backticks.
 */
function quoteIdent(key: string): string {
    return '`' + key.replace(/`/g, '``') + '`';
}
