// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Exists filter operator: checks if a subquery/condition returns any results
 */
export interface OrmExistsFilter {
    type: 'exists';
    value: any; // This could be a subquery or condition
}

export function exists(value: any): OrmExistsFilter {
    return { type: 'exists', value };
}
