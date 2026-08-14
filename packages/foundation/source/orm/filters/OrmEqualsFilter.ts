// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Equality filter operator: field = value
 */
export interface OrmEqualsFilter<T = any> {
    type: 'eq';
    value: T;
}

export function equals<T>(value: T): OrmEqualsFilter<T> {
    return { type: 'eq', value };
}
