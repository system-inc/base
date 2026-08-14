// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Not in array filter operator: field NOT IN (values)
 */
export interface OrmNotInArrayFilter<T = any> {
    type: 'notIn';
    value: T[];
}

export function notInArray<T>(value: T[]): OrmNotInArrayFilter<T> {
    return { type: 'notIn', value };
}
