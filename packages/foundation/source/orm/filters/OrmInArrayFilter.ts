// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * In array filter operator: field IN (values)
 */
export interface OrmInArrayFilter<T = any> {
    type: 'in';
    value: T[];
}

export function inArray<T>(value: T[]): OrmInArrayFilter<T> {
    return { type: 'in', value };
}
