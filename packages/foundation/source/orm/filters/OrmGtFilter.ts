// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Greater than filter operator: field > value
 */
export interface OrmGtFilter<T = any> {
    type: 'gt';
    value: T;
}

export function gt<T>(value: T): OrmGtFilter<T> {
    return { type: 'gt', value };
}
