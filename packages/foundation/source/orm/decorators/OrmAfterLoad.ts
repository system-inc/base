// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { ormAddListener } from '../metadata/OrmSchemaRegistry';

/**
 * Marks an entity method to run after the entity has been hydrated from a
 * database row — useful for computing derived fields. The entity starts with
 * a clean changed-field set.
 *
 * @example
 * ```ts
 * @OrmAfterLoad()
 * computeDisplayName(): void {
 *     this.displayName = `${this.firstName} ${this.lastName}`;
 * }
 * ```
 */
export function OrmAfterLoad(): PropertyDecorator {
    return function (target: object, propertyKey: string | symbol) {
        ormAddListener(
            target.constructor as Constructor,
            'afterLoad',
            propertyKey.toString(),
        );
    };
}
