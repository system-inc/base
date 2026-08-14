// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Not equal filter operator: field != value
 */
export interface OrmNotEqualsFilter<T = any> {
    type: 'ne';
    value: T;
}

export function notEquals<T>(value: T): OrmNotEqualsFilter<T> {
    return { type: 'ne', value };
}
