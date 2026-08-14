// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { PaginationInput } from '../graphql/PaginationInput';
import { OrmRepository } from './database/repository/OrmRepository';
import { OrmTrackingEntity } from './entity/OrmTrackingEntity';
import { OrmFindOptionsOrder } from './interfaces/find/OrmFindOptionsOrder';
import { OrmFindOptionsWhere } from './interfaces/find/OrmFindOptionsWhere';
import { OrmMappedJoin } from './interfaces/find/OrmMappedJoin';
import { OrmFindOptionsRelations } from './interfaces/find/OrmRelationsFindOptions';
import { OrmPaginationInput } from './OrmPaginationInput';

export interface OrmPaginatedFindOptions<EntityType extends OrmTrackingEntity> {
    repository: OrmRepository<EntityType>;
    /**
     * The wire `PaginationInput` (or a `@PaginationInputFor` subclass)
     * can be passed directly — `ormPaginatedFind` bridges it to
     * `OrmPaginationInput` internally, applying any declared allowlists.
     * Pass an `OrmPaginationInput` you bridged yourself only when the
     * resolver needs `scopeWhere`/narrowing first.
     */
    pagination?: OrmPaginationInput | PaginationInput;
    where?: OrmFindOptionsWhere<EntityType>;
    order?: OrmFindOptionsOrder<EntityType>;
    relations?: OrmFindOptionsRelations<EntityType>;

    /**
     * Mapped joins to load with each item (see OrmMappedJoin) — compiled
     * into the same statement as the find, no extra round trips.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    joins?: ReadonlyArray<OrmMappedJoin<any>>;
}
