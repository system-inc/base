// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { OrmJoinColumnOptions } from '../interfaces/OrmJoinColumnOptions';
import { ormAddJoinColumn } from '../metadata/OrmSchemaRegistry';

/**
 * Specifies a join column for a relation.
 * Used with `@OrmManyToOne` and `@OrmOneToOne` relations to configure the foreign key column.
 *
 * @example
 * ```typescript
 * class Post {
 *   @OrmManyToOne(() => User)
 *   @OrmJoinColumn({ name: 'author_id', nullable: false })
 *   author: User;
 * }
 * ```
 */
export function OrmJoinColumn(
    options?: OrmJoinColumnOptions,
): PropertyDecorator {
    return function (target: object, propertyKey: string | symbol) {
        ormAddJoinColumn(
            target.constructor as Constructor,
            String(propertyKey),
            options,
        );
    };
}
