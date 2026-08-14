// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Greater than or equal filter operator: field >= value
 */
export interface OrmGteFilter<T = any> {
    type: 'gte';
    value: T;
}

export function gte<T>(value: T): OrmGteFilter<T> {
    return { type: 'gte', value };
}
