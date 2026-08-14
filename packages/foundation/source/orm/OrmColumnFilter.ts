// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ColumnFilterConditionOperator } from '@system-inc/base-common/graphql/ColumnFilterConditionOperator';
import { Dictionary } from '@system-inc/base-common/type/Dictionary';
import { ColumnFilterInput } from '../graphql/ColumnFilter';
import { and, OrmAndFilter } from './filters/OrmAndFilter';
import { equals } from './filters/OrmEqualsFilter';
import { isOrmFilter, OrmFilter } from './filters/OrmFilter';
import { gte } from './filters/OrmGteFilter';
import { gt } from './filters/OrmGtFilter';
import { inArray } from './filters/OrmInArrayFilter';
import { isNull } from './filters/OrmIsNullFilter';
import { like } from './filters/OrmLikeFilter';
import { lte } from './filters/OrmLteFilter';
import { lt } from './filters/OrmLtFilter';
import { not } from './filters/OrmNotFilter';
import { OrmFindOptionsWhere } from './interfaces/find/OrmFindOptionsWhere';

export function columnFiltersToFindOperators(
    filters: ColumnFilterInput[],
): OrmFindOptionsWhere<object> {
    const whereClause: Dictionary<unknown> = {};
    for (const columnFilter of filters) {
        const filterClause = fieldFilterToOrm(
            columnFilter.column,
            columnFilter.operator,
            columnFilter.value,
        );
        for (const [column, condition] of Object.entries(filterClause)) {
            const existing = whereClause[column];
            // Multiple filters on the same column AND together — the
            // canonical case is a range (gte + lte on a date). A spread
            // here used to silently keep only the LAST condition,
            // over-returning rows the client excluded.
            whereClause[column] =
                existing === undefined
                    ? condition
                    : andConditions(existing, condition);
        }
    }
    return whereClause;
}

/**
 * Combines two conditions on one column with AND, flattening nested
 * `and`s and lifting bare equality values into the filter algebra so
 * mixed shapes (a plain value + an operator filter) compose.
 */
function andConditions(existing: unknown, next: unknown): OrmAndFilter {
    const operands: OrmFilter[] = [];
    for (const condition of [existing, next]) {
        const filter = isOrmFilter(condition)
            ? condition
            : equals(condition as never);
        if (filter.type === 'and') {
            operands.push(...(filter as OrmAndFilter).value);
        } else {
            operands.push(filter);
        }
    }
    return and(...operands);
}

function fieldFilterToOrm(
    columnName: string,
    operator: ColumnFilterConditionOperator,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any,
): Dictionary<object> {
    switch (operator) {
        case ColumnFilterConditionOperator.Equal:
            return {
                [columnName]: value,
            };
        case ColumnFilterConditionOperator.NotEqual:
            return {
                [columnName]: not(value),
            };
        case ColumnFilterConditionOperator.GreaterThan:
            return {
                [columnName]: gt(value),
            };
        case ColumnFilterConditionOperator.GreaterThanOrEqual:
            return {
                [columnName]: gte(value),
            };
        case ColumnFilterConditionOperator.LessThan:
            return {
                [columnName]: lt(value),
            };
        case ColumnFilterConditionOperator.LessThanOrEqual:
            return {
                [columnName]: lte(value),
            };
        case ColumnFilterConditionOperator.In:
            if (!Array.isArray(value)) {
                throw new Error('IN operator requires an array of values');
            }
            return {
                [columnName]: inArray(value),
            };
        case ColumnFilterConditionOperator.NotIn:
            if (!Array.isArray(value)) {
                throw new Error('NOT_IN operator requires an array of values');
            }
            return {
                [columnName]: not(inArray(value)),
            };
        case ColumnFilterConditionOperator.Like:
            return {
                [columnName]: like(value),
            };
        case ColumnFilterConditionOperator.NotLike:
            return {
                [columnName]: not(like(value)),
            };
        case ColumnFilterConditionOperator.IsNull:
            return {
                [columnName]: isNull(),
            };
        case ColumnFilterConditionOperator.IsNotNull:
            return {
                [columnName]: not(isNull()),
            };
        default:
            throw new Error(`Invalid operator ${operator}`);
    }
}
