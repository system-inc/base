// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { OrmOneToManyOptions } from '../metadata/OrmRelationMetadata';
import { ormAddRelation } from '../metadata/OrmSchemaRegistry';

/**
 * Defines a one-to-many relation.
 * One instance of this entity can be referenced by multiple instances of the target entity.
 *
 * @example
 * ```typescript
 * class User {
 *   @OrmOneToMany(() => Post, { inverseSide: 'author' })
 *   posts: Post[];
 * }
 * ```
 */
export function OrmOneToMany<TargetType extends object>(
    target: () => Constructor<TargetType>,
    options: OrmOneToManyOptions<TargetType>,
): PropertyDecorator {
    return function (object: object, propertyKey: string | symbol) {
        ormAddRelation(object.constructor as Constructor, {
            type: 'one-to-many',
            propertyKey: String(propertyKey),
            target,
            inverseSide: options.inverseSide,
        });
    };
}
