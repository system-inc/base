// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmFindOptions } from './OrmFindOptions';

/**
 * Defines a special criteria to find specific entities.
 */
export interface OrmFindOptionsMany<
    EntityType = object,
> extends OrmFindOptions<EntityType> {
    /**
     * Offset (paginated) where from entities should be taken.
     */
    offset?: number;

    /**
     * Limit (paginated) - max number of entities should be taken.
     */
    limit?: number;
}
