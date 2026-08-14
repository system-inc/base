// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

import { OrmFilter } from './OrmFilter';

/**
 * AND logical operator: combines conditions that must all be true.
 *
 * Generic over the operand value type so that, when used inside a typed
 * `OrmFindOptionsWhere<T>`, the wrapped filters are constrained to the
 * column's TS type. Mixing types — e.g. `and(gte(<number>), lte(<Date>))`
 * — becomes a type error.
 */
export interface OrmAndFilter<T = any> {
    type: 'and';
    value: OrmFilter<T>[];
}

export function and<T>(...conditions: OrmFilter<T>[]): OrmAndFilter<T> {
    return { type: 'and', value: conditions };
}
