// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Less than or equal filter operator: field <= value
 */
export interface OrmLteFilter<T = any> {
    type: 'lte';
    value: T;
}

export function lte<T>(value: T): OrmLteFilter<T> {
    return { type: 'lte', value };
}
