// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Not exists filter operator: checks if a subquery/condition returns no results
 */
export interface OrmNotExistsFilter {
    type: 'notExists';
    value: any; // This could be a subquery or condition
}

export function notExists(value: any): OrmNotExistsFilter {
    return { type: 'notExists', value };
}
