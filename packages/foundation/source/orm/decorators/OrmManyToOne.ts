// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { OrmManyToOneOptions } from '../metadata/OrmRelationMetadata';
import { ormAddRelation } from '../metadata/OrmSchemaRegistry';

/**
 * Defines a many-to-one relation.
 * Multiple instances of this entity can reference one instance of the target entity.
 *
 * @example
 * ```typescript
 * class Post {
 *   @OrmManyToOne(() => User, { joinColumn: 'authorId' })
 *   author: User;
 * }
 * ```
 */
export function OrmManyToOne<TargetType extends object>(
    target: () => Constructor<TargetType>,
    options?: OrmManyToOneOptions<TargetType>,
): PropertyDecorator {
    return function (object: object, propertyKey: string | symbol) {
        const joinColumn = options?.joinColumn ?? `${String(propertyKey)}Id`;

        ormAddRelation(object.constructor as Constructor, {
            type: 'many-to-one',
            propertyKey: String(propertyKey),
            target,
            joinColumn,
            inverseSide: options?.inverseSide,
            nullable: options?.nullable,
        });
    };
}
