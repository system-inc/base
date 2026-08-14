// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { ormAddListener } from '../metadata/OrmSchemaRegistry';

/**
 * Marks an entity method to run just before the entity is inserted — the
 * last chance to normalize or fill fields that persist with the insert.
 *
 * @example
 * ```ts
 * @OrmBeforeInsert()
 * normalizeEmail(): void {
 *     this.email = this.email.trim().toLowerCase();
 * }
 * ```
 */
export function OrmBeforeInsert(): PropertyDecorator {
    return function (target: object, propertyKey: string | symbol) {
        ormAddListener(
            target.constructor as Constructor,
            'beforeInsert',
            propertyKey.toString(),
        );
    };
}
