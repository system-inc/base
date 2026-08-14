// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { ormAddListener } from '../metadata/OrmSchemaRegistry';

/**
 * Marks an entity method to run just before the entity is deleted.
 *
 * @example
 * ```ts
 * @OrmBeforeDelete()
 * assertDeletable(): void {
 *     if (this.locked) throw new Error('Cannot delete a locked row.');
 * }
 * ```
 */
export function OrmBeforeDelete(): PropertyDecorator {
    return function (target: object, propertyKey: string | symbol) {
        ormAddListener(
            target.constructor as Constructor,
            'beforeDelete',
            propertyKey.toString(),
        );
    };
}
