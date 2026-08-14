// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Between filter operator: field BETWEEN min AND max
 */
export interface OrmBetweenFilter<T = any> {
    type: 'between';
    min: T;
    max: T;
}

export function between<T>(min: T, max: T): OrmBetweenFilter<T> {
    return { type: 'between', min, max };
}
