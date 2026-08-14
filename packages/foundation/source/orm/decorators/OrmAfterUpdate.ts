// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { ormAddListener } from '../metadata/OrmSchemaRegistry';

/**
 * Marks an entity method to run after the entity has been updated. The
 * entity's changed-field set is reset before the listener runs.
 *
 * @example
 * ```ts
 * @OrmAfterUpdate()
 * invalidateCache(): void {
 *     this.cachedSummary = undefined;
 * }
 * ```
 */
export function OrmAfterUpdate(): PropertyDecorator {
    return function (target: object, propertyKey: string | symbol) {
        ormAddListener(
            target.constructor as Constructor,
            'afterUpdate',
            propertyKey.toString(),
        );
    };
}
