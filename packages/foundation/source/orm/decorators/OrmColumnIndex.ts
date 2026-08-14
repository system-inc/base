// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { ormAddColumnIndex } from '../metadata/OrmSchemaRegistry';

/**
 * Convenience decorator to add an index on a single column.
 * Can be used with or without a custom name.
 *
 * @param name Optional custom name for the index. If not provided,
 *             generates: idx_<tableName>_<propertyName>
 *
 * @example
 * ```typescript
 * class User {
 *   @OrmColumn({ kind: 'varchar', length: 36 })
 *   @OrmColumnIndex() // Auto-generates: idx_user_accountId
 *   declare accountId: string;
 *
 *   @OrmColumn({ kind: 'varchar', length: 100 })
 *   @OrmColumnIndex('idx_user_email') // Custom name
 *   declare email: string;
 * }
 * ```
 */
export function OrmColumnIndex(name?: string): PropertyDecorator {
    return function (target: object, propertyKey: string | symbol) {
        const ctor = target.constructor as Constructor;
        ormAddColumnIndex(ctor, String(propertyKey), name);
    };
}
