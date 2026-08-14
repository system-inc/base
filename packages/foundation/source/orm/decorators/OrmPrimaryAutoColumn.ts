// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { OrmIntegerSizeType } from '../interfaces/OrmIntegerLengthType';
import { ormAddPrimaryAutoColumn } from '../metadata/OrmSchemaRegistry';

/**
 * Marks a property as the table's auto-generated primary key.
 *
 * With `'uuid'` the key is a generated UUID string; with `'serial'` it is an
 * auto-incremented integer (optionally sized).
 *
 * @param strategy How the key is generated: `'uuid'` or `'serial'`.
 * @example
 * ```ts
 * @OrmPrimaryAutoColumn('uuid')
 * declare id: string;
 * ```
 */
export function OrmPrimaryAutoColumn(strategy: 'uuid'): PropertyDecorator;
/**
 * Marks a property as the table's auto-incremented integer primary key.
 *
 * @param strategy The `'serial'` strategy.
 * @param size The integer size of the column.
 * @example
 * ```ts
 * @OrmPrimaryAutoColumn('serial')
 * declare id: number;
 * ```
 */
export function OrmPrimaryAutoColumn(
    strategy: 'serial',
    size?: OrmIntegerSizeType,
): PropertyDecorator;
export function OrmPrimaryAutoColumn(
    strategy: 'serial' | 'uuid',
    size?: OrmIntegerSizeType,
): PropertyDecorator {
    return function (target: object, propertyKey: string | symbol) {
        const ctor = target.constructor as Constructor;
        ormAddPrimaryAutoColumn(ctor, propertyKey.toString(), strategy, size);
    };
}
