// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Is not null filter operator: field IS NOT NULL
 */
export interface OrmIsNotNullFilter {
    type: 'isNotNull';
}

export function isNotNull(): OrmIsNotNullFilter {
    return { type: 'isNotNull' };
}
