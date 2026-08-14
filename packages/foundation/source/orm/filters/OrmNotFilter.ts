// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

import { OrmFilter } from './OrmFilter';

/**
 * NOT logical operator: negates a condition.
 *
 * Generic over the operand value type — see {@link OrmAndFilter} for
 * rationale.
 */
export interface OrmNotFilter<T = any> {
    type: 'not';
    value: OrmFilter<T>;
}

export function not<T>(value: OrmFilter<T>): OrmNotFilter<T> {
    return { type: 'not', value };
}
