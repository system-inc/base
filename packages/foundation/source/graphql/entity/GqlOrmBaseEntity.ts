// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmBaseEntity } from '../../orm/entity/OrmBaseEntity';
import { GqlField } from '../decorators/GqlField';
import { GqlInterfaceType } from '../decorators/GqlInterfaceType';
import { GqlObjectType } from '../decorators/GqlObjectType';

/**
 * Orm (Drizzle) counterpart of {@link GqlBaseEntity}: exposes the base
 * entity's `id` and `createdAt` columns as GraphQL fields.
 */
@GqlInterfaceType()
@GqlObjectType()
export abstract class GqlOrmBaseEntity extends OrmBaseEntity {
    @GqlField(() => String)
    declare id: string;

    @GqlField(() => Date)
    declare createdAt: Date;
}
