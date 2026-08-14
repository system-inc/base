// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Is null filter operator: field IS NULL
 */
export interface OrmIsNullFilter {
    type: 'isNull';
}

export function isNull(): OrmIsNullFilter {
    return { type: 'isNull' };
}
