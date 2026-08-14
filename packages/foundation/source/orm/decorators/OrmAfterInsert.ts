// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { ormAddListener } from '../metadata/OrmSchemaRegistry';

/**
 * Marks an entity method to run after the entity has been inserted. The
 * entity's changed-field set is reset before the listener runs.
 *
 * @example
 * ```ts
 * @OrmAfterInsert()
 * logCreation(): void {
 *     console.log(`created ${this.id}`);
 * }
 * ```
 */
export function OrmAfterInsert(): PropertyDecorator {
    return function (target: object, propertyKey: string | symbol) {
        ormAddListener(
            target.constructor as Constructor,
            'afterInsert',
            propertyKey.toString(),
        );
    };
}
