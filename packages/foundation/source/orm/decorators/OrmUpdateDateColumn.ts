// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { OrmColumnOptions } from '../interfaces/OrmColumnOptions';
import { ormAddDateColumn } from '../metadata/OrmSchemaRegistry';

/**
 * Marks a property as the row's last-update timestamp, initialized to the
 * creation time on insert and refreshed automatically on every update.
 *
 * The column is non-nullable by default: a row that has never been updated is
 * one where `updatedAt` equals `createdAt`, not one where it is null.
 *
 * @param options Column options.
 * @example
 * ```ts
 * @OrmUpdateDateColumn()
 * declare updatedAt: Date;
 * ```
 */
export function OrmUpdateDateColumn(
    options?: OrmColumnOptions,
): PropertyDecorator {
    return function (target: object, propertyKey: string | symbol) {
        // Non-nullable by default (like @OrmCreateDateColumn): updatedAt is
        // initialized to createdAt on insert, so it always has a value. A row
        // is "never updated" when createdAt === updatedAt, not when null.
        ormAddDateColumn(
            target.constructor as Constructor,
            'update',
            propertyKey.toString(),
            options,
        );
    };
}
