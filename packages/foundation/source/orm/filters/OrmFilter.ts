// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Union type of all ORM filter operators
 */

import { OrmAndFilter } from './OrmAndFilter';
import { OrmBetweenFilter } from './OrmBetweenFilter';
import { OrmEqualsFilter } from './OrmEqualsFilter';
import { OrmExistsFilter } from './OrmExistsFilter';
import { OrmGteFilter } from './OrmGteFilter';
import { OrmGtFilter } from './OrmGtFilter';
import { OrmInArrayFilter } from './OrmInArrayFilter';
import { OrmIsNotNullFilter } from './OrmIsNotNullFilter';
import { OrmIsNullFilter } from './OrmIsNullFilter';
import { OrmLikeFilter } from './OrmLikeFilter';
import { OrmLteFilter } from './OrmLteFilter';
import { OrmLtFilter } from './OrmLtFilter';
import { OrmNotBetweenFilter } from './OrmNotBetweenFilter';
import { OrmNotEqualsFilter } from './OrmNotEqualsFilter';
import { OrmNotExistsFilter } from './OrmNotExistsFilter';
import { OrmNotFilter } from './OrmNotFilter';
import { OrmNotInArrayFilter } from './OrmNotInArrayFilter';
import { OrmNotLikeFilter } from './OrmNotLikeFilter';
import { OrmOrFilter } from './OrmOrFilter';

/**
 * Union type of all filter operators
 * The discriminated union allows TypeScript to narrow types based on the 'type' field
 */
export type OrmFilter<T = any> =
    | OrmEqualsFilter<T>
    | OrmNotEqualsFilter<T>
    | OrmGtFilter<T>
    | OrmGteFilter<T>
    | OrmLtFilter<T>
    | OrmLteFilter<T>
    | OrmInArrayFilter<T>
    | OrmNotInArrayFilter<T>
    | OrmBetweenFilter<T>
    | OrmNotBetweenFilter<T>
    | OrmLikeFilter
    | OrmNotLikeFilter
    | OrmIsNullFilter
    | OrmIsNotNullFilter
    | OrmExistsFilter
    | OrmNotExistsFilter
    | OrmNotFilter<T>
    | OrmAndFilter<T>
    | OrmOrFilter<T>;

/**
 * Type guard to check if a value is an ORM filter
 */
export function isOrmFilter(value: any): value is OrmFilter {
    if (!value || typeof value !== 'object' || !('type' in value)) {
        return false;
    }

    const filterTypes = [
        'eq',
        'ne',
        'gt',
        'gte',
        'lt',
        'lte',
        'in',
        'notIn',
        'between',
        'notBetween',
        'like',
        'notLike',
        'isNull',
        'isNotNull',
        'exists',
        'notExists',
        'not',
        'and',
        'or',
    ];

    return filterTypes.includes(value.type);
}

/**
 * Helper type to extract the value type from a filter
 */
export type ExtractFilterValue<F> =
    F extends OrmEqualsFilter<infer T>
        ? T
        : F extends OrmNotEqualsFilter<infer T>
          ? T
          : F extends OrmGtFilter<infer T>
            ? T
            : F extends OrmGteFilter<infer T>
              ? T
              : F extends OrmLtFilter<infer T>
                ? T
                : F extends OrmLteFilter<infer T>
                  ? T
                  : F extends OrmInArrayFilter<infer T>
                    ? T[]
                    : F extends OrmNotInArrayFilter<infer T>
                      ? T[]
                      : F extends OrmBetweenFilter<infer T>
                        ? [T, T]
                        : F extends OrmNotBetweenFilter<infer T>
                          ? [T, T]
                          : F extends OrmLikeFilter
                            ? string
                            : F extends OrmNotLikeFilter
                              ? string
                              : F extends OrmIsNullFilter
                                ? null
                                : F extends OrmIsNotNullFilter
                                  ? any
                                  : F extends OrmExistsFilter
                                    ? any
                                    : F extends OrmNotExistsFilter
                                      ? any
                                      : F extends OrmNotFilter<infer T>
                                        ? OrmFilter<T>
                                        : F extends OrmAndFilter<infer T>
                                          ? OrmFilter<T>[]
                                          : F extends OrmOrFilter<infer T>
                                            ? OrmFilter<T>[]
                                            : never;
