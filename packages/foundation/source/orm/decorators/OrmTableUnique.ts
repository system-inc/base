// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { AnyClass } from '@system-inc/base-common/type/Constructor';
import { ormAddUniqueConstraint } from '../metadata/OrmSchemaRegistry';

/**
 * Decorator to add a unique constraint to a table with auto-generated name.
 *
 * @param columns The columns to include in the unique constraint
 *
 * @example
 * ```typescript
 * // Auto-generated name: uc_user_email_username
 * @OrmTableUnique(['email', 'username'])
 * class User {
 *   // ...
 * }
 * ```
 */
export function OrmTableUnique(
    columns: string[],
): <T extends AnyClass>(ctor: T) => void;

/**
 * Decorator to add a unique constraint to a table with custom name.
 *
 * @param name Custom name for the unique constraint
 * @param columns The columns to include in the unique constraint
 */
export function OrmTableUnique(
    name: string,
    columns: string[],
): <T extends AnyClass>(ctor: T) => void;

export function OrmTableUnique(
    nameOrColumns: string | string[],
    columns?: string[],
) {
    return function <T extends AnyClass>(ctor: T) {
        if (Array.isArray(nameOrColumns)) {
            // First overload: OrmTableUnique(columns)
            ormAddUniqueConstraint(ctor, nameOrColumns, undefined);
        } else {
            // Second overload: OrmTableUnique(name, columns)
            ormAddUniqueConstraint(ctor, columns!, nameOrColumns);
        }
    };
}
