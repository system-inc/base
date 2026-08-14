// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * A column inside an index, optionally indexed by only its leading characters.
 *
 * MySQL sizes an index key by each column's DECLARED width, so a
 * `varchar(1024)` in utf8mb4 reserves 4096 bytes and blows InnoDB's 3072-byte
 * ceiling on its own — the index simply cannot be created. A prefix indexes the
 * first N characters instead, which is what makes long titles, paths, and
 * subjects indexable at all.
 *
 * A prefix still serves equality and leading-wildcard-free `LIKE`, and still
 * orders rows; it cannot serve a covering-index-only read, because the stored
 * key is truncated.
 */
export interface OrmIndexColumnWithPrefix {
    column: string;

    /**
     * Number of leading CHARACTERS to index (not bytes — MySQL's `col(n)`
     * counts characters, and the byte cost is `n × 4` under utf8mb4).
     */
    prefixLength: number;
}

/**
 * A column reference in an index declaration: a bare property name, or a name
 * paired with a prefix length.
 *
 * The bare-string form is the overwhelming majority and stays untouched, so
 * adding prefix support changed no existing declaration.
 */
export type OrmIndexColumn = string | OrmIndexColumnWithPrefix;

/**
 * The property name an index column refers to, whichever form it takes.
 */
export function ormIndexColumnName(indexColumn: OrmIndexColumn): string {
    return typeof indexColumn === 'string' ? indexColumn : indexColumn.column;
}

/**
 * The prefix length, or undefined when the whole column is indexed.
 */
export function ormIndexColumnPrefixLength(
    indexColumn: OrmIndexColumn,
): number | undefined {
    return typeof indexColumn === 'string'
        ? undefined
        : indexColumn.prefixLength;
}
