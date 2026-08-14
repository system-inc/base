// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { ormAddListener } from '../metadata/OrmSchemaRegistry';

/**
 * Marks an entity method to run after the entity has been deleted.
 *
 * @example
 * ```ts
 * @OrmAfterDelete()
 * logDeletion(): void {
 *     console.log(`deleted ${this.id}`);
 * }
 * ```
 */
export function OrmAfterDelete(): PropertyDecorator {
    return function (target: object, propertyKey: string | symbol) {
        ormAddListener(
            target.constructor as Constructor,
            'afterDelete',
            propertyKey.toString(),
        );
    };
}
