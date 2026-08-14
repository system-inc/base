// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { DecoratorRegistry } from '@system-inc/base-common/decorator/DecoratorRegistry';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { OrmTableOptions } from '../interfaces/OrmTableOptions';
import { ormAddTable } from '../metadata/OrmSchemaRegistry';

export const OrmTableDecoratorName = 'OrmTable';

/**
 * Marks a class as a database entity backed by a table.
 *
 * Register the entity in a module's (or the worker's) `orm.entities`; the
 * schema builder turns its decorated columns into the table definition, and
 * repositories for it are injected with `@InjectRepository`. Entities extend
 * `OrmTrackingEntity` (or `OrmBaseEntity`/`OrmMutableBaseEntity`) so instances
 * track their own changed fields.
 *
 * @param name The table name. Defaults to the class name when omitted.
 * @param options Additional table options.
 * @example
 * ```ts
 * @OrmTable('books')
 * export class Book extends OrmTrackingEntity {
 *     @OrmPrimaryAutoColumn('uuid')
 *     declare id: string;
 *
 *     @OrmColumn({ kind: 'varchar', length: 255 })
 *     declare title: string;
 *
 *     @OrmCreateDateColumn()
 *     declare createdAt: Date;
 * }
 * ```
 */
export function OrmTable(name?: string, options?: OrmTableOptions) {
    return function <T extends Constructor>(ctor: T) {
        DecoratorRegistry.get().mark(
            ctor as Constructor<object>,
            OrmTableDecoratorName,
        );
        ormAddTable(ctor, name, options);
    };
}
