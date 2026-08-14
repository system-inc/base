// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { ormAddColumnUnique } from '../metadata/OrmSchemaRegistry';

/**
 * Convenience decorator to add a unique constraint on a single column.
 * Can be used with or without a custom name.
 *
 * @param name Optional custom name for the unique constraint. If not provided,
 *             generates: unq_<tableName>_<propertyName>
 *
 * @example
 * ```typescript
 * class User {
 *   @OrmColumn({ kind: 'varchar', length: 100 })
 *   @OrmColumnUnique() // Auto-generates: unq_user_email
 *   declare email: string;
 *
 *   @OrmColumn({ kind: 'varchar', length: 50 })
 *   @OrmColumnUnique('unq_username') // Custom name
 *   declare username: string;
 * }
 * ```
 */
export function OrmColumnUnique(name?: string): PropertyDecorator {
    return function (target: object, propertyKey: string | symbol) {
        const ctor = target.constructor as Constructor;
        ormAddColumnUnique(ctor, String(propertyKey), name);
    };
}
