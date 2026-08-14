// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Not between filter operator: field NOT BETWEEN min AND max
 */
export interface OrmNotBetweenFilter<T = any> {
    type: 'notBetween';
    min: T;
    max: T;
}

export function notBetween<T>(min: T, max: T): OrmNotBetweenFilter<T> {
    return { type: 'notBetween', min, max };
}
