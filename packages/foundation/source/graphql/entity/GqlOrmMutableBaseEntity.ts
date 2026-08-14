// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmUpdateDateColumn } from '../../orm/decorators/OrmUpdateDateColumn';
import { GqlField } from '../decorators/GqlField';
import { GqlInterfaceType } from '../decorators/GqlInterfaceType';
import { GqlObjectType } from '../decorators/GqlObjectType';
import { GqlOrmBaseEntity } from './GqlOrmBaseEntity';

/**
 * Orm (Drizzle) counterpart of {@link GqlMutableBaseEntity}: adds the
 * `updatedAt` column and exposes it as a GraphQL field. `updatedAt` is
 * initialized to the same instant as `createdAt` on insert, then bumped on
 * every update — see {@link hasBeenUpdated}.
 */
@GqlInterfaceType({ implements: GqlOrmBaseEntity })
@GqlObjectType()
export abstract class GqlOrmMutableBaseEntity extends GqlOrmBaseEntity {
    @GqlField(() => Date)
    @OrmUpdateDateColumn({ name: 'updatedAt' })
    declare updatedAt: Date;

    /**
     * Whether this row has been updated since it was created.
     *
     * `updatedAt` is initialized to the same instant as `createdAt` on insert,
     * then bumped on every update — so the row has never been updated exactly
     * when `updatedAt === createdAt`. (This replaces the old "updatedAt is
     * null" sentinel, which couldn't work on backends where the column is
     * NOT NULL.)
     */
    get hasBeenUpdated(): boolean {
        return this.updatedAt.getTime() !== this.createdAt.getTime();
    }
}
