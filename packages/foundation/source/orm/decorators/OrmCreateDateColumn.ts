// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { OrmColumnOptions } from '../interfaces/OrmColumnOptions';
import { ormAddDateColumn } from '../metadata/OrmSchemaRegistry';

/**
 * Marks a property as the row's creation timestamp, set automatically on
 * insert and immutable afterwards — upserts never overwrite it.
 *
 * @param options Column options.
 * @example
 * ```ts
 * @OrmCreateDateColumn()
 * declare createdAt: Date;
 * ```
 */
export function OrmCreateDateColumn(
    options?: OrmColumnOptions,
): PropertyDecorator {
    return function (target: object, propertyKey: string | symbol) {
        ormAddDateColumn(
            target.constructor as Constructor,
            'create',
            propertyKey.toString(),
            options,
        );
    };
}
