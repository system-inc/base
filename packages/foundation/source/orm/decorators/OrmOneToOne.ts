// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { OrmOneToOneOptions } from '../metadata/OrmRelationMetadata';
import { ormAddRelation } from '../metadata/OrmSchemaRegistry';

/**
 * Defines a one-to-one relation.
 * One instance of this entity references exactly one instance of the target entity.
 *
 * @example
 * ```typescript
 * class User {
 *   @OrmOneToOne(() => Profile, { joinColumn: 'profileId' })
 *   profile: Profile;
 * }
 * ```
 */
export function OrmOneToOne<TargetType extends object>(
    target: () => Constructor<TargetType>,
    options?: OrmOneToOneOptions<TargetType>,
): PropertyDecorator {
    return function (object: object, propertyKey: string | symbol) {
        const joinColumn = options?.joinColumn ?? `${String(propertyKey)}Id`;

        ormAddRelation(object.constructor as Constructor, {
            type: 'one-to-one',
            propertyKey: String(propertyKey),
            target,
            joinColumn,
            inverseSide: options?.inverseSide,
            nullable: options?.nullable,
        });
    };
}
