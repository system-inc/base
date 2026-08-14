// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Like filter operator for pattern matching: field LIKE pattern
 * Use % for wildcard (e.g., '%test%' matches any string containing 'test')
 * Case sensitivity depends on database collation (MySQL/SQLite default to case-insensitive)
 */
export interface OrmLikeFilter {
    type: 'like';
    pattern: string;
}

export function like(pattern: string): OrmLikeFilter {
    return { type: 'like', pattern };
}
