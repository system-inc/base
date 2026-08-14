// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Not like filter operator: field NOT LIKE pattern
 * Use % for wildcard (e.g., '%test%' excludes any string containing 'test')
 * Case sensitivity depends on database collation (MySQL/SQLite default to case-insensitive)
 */
export interface OrmNotLikeFilter {
    type: 'notLike';
    pattern: string;
}

export function notLike(pattern: string): OrmNotLikeFilter {
    return { type: 'notLike', pattern };
}
