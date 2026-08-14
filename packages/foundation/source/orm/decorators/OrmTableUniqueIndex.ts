// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { AnyClass } from '@system-inc/base-common/type/Constructor';
import { OrmTableIndexOptions } from '../interfaces/OrmTableIndexOptions';
import { OrmTableIndex } from './OrmTableIndex';

/**
 * Adds a unique index over the given columns to the entity's table, with an
 * auto-generated name.
 *
 * @param columns The columns to include in the unique index.
 * @param options Additional index options.
 * @example
 * ```ts
 * @OrmTable('members')
 * @OrmTableUniqueIndex(['organizationId', 'accountId'])
 * export class Member extends OrmTrackingEntity { ... }
 * ```
 */
export function OrmTableUniqueIndex(
    columns: string[],
    options?: OrmTableIndexOptions,
): <T extends AnyClass>(ctor: T) => void;

/**
 * Adds a named unique index over the given columns to the entity's table.
 *
 * @param name Custom name for the unique index.
 * @param columns The columns to include in the unique index.
 * @param options Additional index options.
 * @example
 * ```ts
 * @OrmTable('members')
 * @OrmTableUniqueIndex('uniq_org_account', ['organizationId', 'accountId'])
 * export class Member extends OrmTrackingEntity { ... }
 * ```
 */
export function OrmTableUniqueIndex(
    name: string,
    columns: string[],
    options?: OrmTableIndexOptions,
): <T extends AnyClass>(ctor: T) => void;

export function OrmTableUniqueIndex(
    nameOrColumns: string | string[],
    columnsOrOptions?: string[] | OrmTableIndexOptions,
    options?: OrmTableIndexOptions,
) {
    if (Array.isArray(nameOrColumns)) {
        // First overload: OrmUniqueIndex(columns, options?)
        return OrmTableIndex(nameOrColumns, {
            ...(columnsOrOptions as OrmTableIndexOptions | undefined),
            unique: true,
        });
    } else {
        // Second overload: OrmUniqueIndex(name, columns, options?)
        return OrmTableIndex(nameOrColumns, columnsOrOptions as string[], {
            ...options,
            unique: true,
        });
    }
}
