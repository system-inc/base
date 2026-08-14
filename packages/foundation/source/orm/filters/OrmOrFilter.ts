// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

import { OrmFilter } from './OrmFilter';

/**
 * OR logical operator: combines conditions where at least one must be
 * true.
 *
 * Generic over the operand value type — see {@link OrmAndFilter} for
 * rationale.
 */
export interface OrmOrFilter<T = any> {
    type: 'or';
    value: OrmFilter<T>[];
}

export function or<T>(...conditions: OrmFilter<T>[]): OrmOrFilter<T> {
    return { type: 'or', value: conditions };
}
