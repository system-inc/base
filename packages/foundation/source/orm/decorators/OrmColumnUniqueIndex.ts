// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { ormAddColumnUniqueIndex } from '../metadata/OrmSchemaRegistry';

/**
 * Convenience decorator to add a unique index on a single column.
 * This is different from OrmColumnUnique which creates a unique constraint.
 * Can be used with or without a custom name.
 *
 * @param name Optional custom name for the unique index. If not provided,
 *             generates: unq_idx_<tableName>_<propertyName>
 *
 * @example
 * ```typescript
 * class User {
 *   @OrmColumn({ kind: 'varchar', length: 100 })
 *   @OrmColumnUniqueIndex() // Auto-generates: unq_idx_user_email
 *   declare email: string;
 *
 *   @OrmColumn({ kind: 'varchar', length: 50 })
 *   @OrmColumnUniqueIndex('unq_idx_custom_username') // Custom name
 *   declare username: string;
 * }
 * ```
 */
export function OrmColumnUniqueIndex(name?: string): PropertyDecorator {
    return function (target: object, propertyKey: string | symbol) {
        const ctor = target.constructor as Constructor;
        ormAddColumnUniqueIndex(ctor, String(propertyKey), name);
    };
}
