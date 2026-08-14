// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { AnyClass } from '@system-inc/base-common/type/Constructor';
import { OrmIndexColumn } from '../interfaces/OrmIndexColumn';
import { OrmTableIndexOptions } from '../interfaces/OrmTableIndexOptions';
import { ormAddIndex } from '../metadata/OrmSchemaRegistry';

/**
 * Adds an index over the given columns to the entity's table, with an
 * auto-generated name.
 *
 * @param columns The columns to include in the index.
 * @param options Additional index options.
 * @example
 * ```ts
 * @OrmTable('orders')
 * @OrmTableIndex(['orderDate'])
 * export class Order extends OrmTrackingEntity { ... }
 * ```
 */
export function OrmTableIndex(
    columns: OrmIndexColumn[],
    options?: OrmTableIndexOptions,
): <T extends AnyClass>(ctor: T) => void;

/**
 * Adds a named index over the given columns to the entity's table.
 *
 * @param name Custom name for the index.
 * @param columns The columns to include in the index.
 * @param options Additional index options.
 * @example
 * ```ts
 * @OrmTable('orders')
 * @OrmTableIndex('idx_customer_status', ['customerId', 'status'])
 * export class Order extends OrmTrackingEntity { ... }
 * ```
 */
export function OrmTableIndex(
    name: string,
    columns: OrmIndexColumn[],
    options?: OrmTableIndexOptions,
): <T extends AnyClass>(ctor: T) => void;

export function OrmTableIndex(
    nameOrColumns: string | OrmIndexColumn[],
    columnsOrOptions?: OrmIndexColumn[] | OrmTableIndexOptions,
    options?: OrmTableIndexOptions,
) {
    return function <T extends AnyClass>(ctor: T) {
        if (Array.isArray(nameOrColumns)) {
            // First overload: OrmIndex(columns, options?)
            ormAddIndex(
                ctor,
                undefined,
                nameOrColumns,
                columnsOrOptions as OrmTableIndexOptions | undefined,
            );
        } else {
            // Second overload: OrmIndex(name, columns, options?)
            ormAddIndex(
                ctor,
                nameOrColumns,
                columnsOrOptions as OrmIndexColumn[],
                options,
            );
        }
    };
}
