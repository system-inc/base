// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Options for the `@OrmJoinColumn` decorator.
 */
export interface OrmJoinColumnOptions {
    /**
     * Name of the column in the database
     */
    name?: string;

    /**
     * Name of the column in the referenced entity to which this column refers
     * Default is the primary key of the referenced table
     */
    referencedColumnName?: string;

    /**
     * Whether this column can be NULL
     */
    nullable?: boolean;
}
