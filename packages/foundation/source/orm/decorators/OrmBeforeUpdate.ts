// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { ormAddListener } from '../metadata/OrmSchemaRegistry';

/**
 * Marks an entity method to run just before the entity is updated. Fields
 * changed here are persisted with the update.
 *
 * @example
 * ```ts
 * @OrmBeforeUpdate()
 * bumpRevision(): void {
 *     this.revision += 1;
 * }
 * ```
 */
export function OrmBeforeUpdate(): PropertyDecorator {
    return function (target: object, propertyKey: string | symbol) {
        ormAddListener(
            target.constructor as Constructor,
            'beforeUpdate',
            propertyKey.toString(),
        );
    };
}
