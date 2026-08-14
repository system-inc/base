// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { OrmColumnOptions } from '../interfaces/OrmColumnOptions';
import { OrmColumnType } from '../interfaces/OrmColumnType';
import { ormAddColumn } from '../metadata/OrmSchemaRegistry';

/**
 * Maps a property to a database column of the given kind.
 *
 * The property must use the `declare` keyword — columns are backed by
 * tracking accessors installed at construction time, so entity instances
 * record their own changed fields for minimal partial updates.
 *
 * Mode-bearing kinds (`bigint`, `decimal`, `datetime`) require an explicit
 * `mode` choosing the JavaScript representation — see {@link OrmColumnType}.
 *
 * @param kind The column type and its type-specific options.
 * @param options Column options such as `nullable`, `unique`, or `default`.
 * @example
 * ```ts
 * @OrmColumn({ kind: 'varchar', length: 255 })
 * declare title: string;
 *
 * @OrmColumn({ kind: 'varchar', length: 13 }, { unique: true })
 * declare isbn: string;
 *
 * @OrmColumn({ kind: 'integer' }, { nullable: true })
 * declare pages: number | null;
 * ```
 */
export function OrmColumn<T extends OrmColumnType['kind']>(
    kind: OrmColumnType,
    options?: OrmColumnOptions<T>,
): PropertyDecorator {
    return function (target: object, propertyKey: string | symbol) {
        ormAddColumn(
            target.constructor as Constructor,
            propertyKey.toString(),
            kind,
            options,
        );
    };
}
