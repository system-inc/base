// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Dictionary } from '@system-inc/base-common/type/Dictionary';
import { OrmDateEventMap } from '../interfaces/OrmDateEventType';
import { OrmJoinColumnOptions } from '../interfaces/OrmJoinColumnOptions';
import { OrmListenerEventMap } from '../interfaces/OrmListenerEventType';
import { OrmTableOptions } from '../interfaces/OrmTableOptions';
import { OrmColumnMetadata } from './OrmColumnMetadata';
import {
    getPrimaryKeyColumns as getPKColumns,
    OrmPrimaryKeyInfo,
} from './OrmPrimaryKeyInfo';
import { OrmRelationMetadata } from './OrmRelationMetadata';
import { OrmTableIndexMetadata } from './OrmTableIndexMetadata';
import { OrmTableUniqueMetadata } from './OrmTableUniqueMetadata';

export interface OrmTableMetadata {
    name: string;
    options?: OrmTableOptions;
    columns: OrmColumnMetadata[];
    relations: OrmRelationMetadata[];
    primaryKey?: OrmPrimaryKeyInfo;
    uniqueConstraints: OrmTableUniqueMetadata[]; // For composite unique constraints
    indexes: OrmTableIndexMetadata[];
    listeners: OrmListenerEventMap;
    dateColumns: OrmDateEventMap;
    joinColumns: Dictionary<OrmJoinColumnOptions>;
}

/**
 * Get the property keys of all primary key columns
 */
export function getPrimaryKeyPropertyKeys(
    metadata: OrmTableMetadata,
): string[] {
    // First check if there's a primaryKey field defined
    const pkFromInfo = getPKColumns(metadata.primaryKey);
    if (pkFromInfo.length > 0) {
        return pkFromInfo;
    }

    // Otherwise, look for columns with primaryKey: true option
    const pkColumns = metadata.columns
        .filter((col) => col.options?.primaryKey === true)
        .map((col) => col.propertyKey);

    return pkColumns;
}

/**
 * Throws if the table is not marked `truncatable: true` in its
 * `@OrmTable()` options. Called before any `truncate()` operation to
 * prevent accidental full-table wipes on tables that weren't designed
 * to be wiped.
 */
export function requireTruncatable(metadata: OrmTableMetadata): void {
    if (metadata.options?.truncatable !== true) {
        throw new Error(
            `Cannot truncate table "${metadata.name}" — entity is not marked truncatable. ` +
                `Add { truncatable: true } to @OrmTable() on the entity class to allow truncation.`,
        );
    }
}

/**
 * Check if the table has any primary key columns
 */
export function hasPrimaryKey(metadata: OrmTableMetadata): boolean {
    // Check if there's a primaryKey field defined
    if (metadata.primaryKey !== undefined) {
        return true;
    }

    // Otherwise, check for columns with primaryKey: true option
    return metadata.columns.some((col) => col.options?.primaryKey === true);
}
