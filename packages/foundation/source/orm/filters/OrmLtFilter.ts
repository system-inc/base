// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Less than filter operator: field < value
 */
export interface OrmLtFilter<T = any> {
    type: 'lt';
    value: T;
}

export function lt<T>(value: T): OrmLtFilter<T> {
    return { type: 'lt', value };
}
