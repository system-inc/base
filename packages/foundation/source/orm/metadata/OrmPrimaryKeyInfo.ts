// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmIntegerSizeType } from '../interfaces/OrmIntegerLengthType';

export type OrmPrimaryKeyInfo =
    | {
          type: 'single';
          column: string;
      }
    | {
          type: 'composite';
          columns: string[];
          name?: string; // Custom constraint name for composite primary key
      }
    | {
          type: 'auto-uuid';
          column: string;
      }
    | {
          type: 'auto-serial';
          column: string;
          size?: OrmIntegerSizeType;
      };

/**
 * Get all primary key columns from the primary key info
 */
export function getPrimaryKeyColumns(primaryKey?: OrmPrimaryKeyInfo): string[] {
    if (!primaryKey) return [];

    switch (primaryKey.type) {
        case 'single':
        case 'auto-uuid':
        case 'auto-serial':
            return [primaryKey.column];
        case 'composite':
            return primaryKey.columns;
    }
}

/**
 * Check if a column is part of the primary key
 */
export function isColumnPrimaryKey(
    primaryKey: OrmPrimaryKeyInfo | undefined,
    column: string,
): boolean {
    if (!primaryKey) return false;

    switch (primaryKey.type) {
        case 'single':
        case 'auto-uuid':
        case 'auto-serial':
            return primaryKey.column === column;
        case 'composite':
            return primaryKey.columns.includes(column);
    }
}
