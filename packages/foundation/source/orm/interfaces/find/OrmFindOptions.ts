// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmEntityKeys } from '../OrmPartialEntity';
import { OrmFindOptionsOrder } from './OrmFindOptionsOrder';
import { OrmFindOptionsWhere } from './OrmFindOptionsWhere';
import { OrmMappedJoin } from './OrmMappedJoin';
import { OrmFindOptionsRelations } from './OrmRelationsFindOptions';

/**
 * Defines a special criteria to find specific entity.
 */
export interface OrmFindOptions<EntityType = object> {
    /**
     * Adds a comment with the supplied string in the generated query.  This is
     * helpful for debugging purposes, such as finding a specific query in the
     * database server's logs, or for categorization using an APM product.
     */
    comment?: string;

    /**
     * Specifies what columns should be retrieved.
     */
    select?: OrmEntityKeys<EntityType>;

    /**
     * Condition(s) to match entities. Fields within one object are ANDed;
     * an array is OR across its elements.
     */
    where?: OrmFindOptionsWhere<EntityType>[] | OrmFindOptionsWhere<EntityType>;

    /**
     * Indicates what relations of entity should be loaded (simplified left join form).
     */
    relations?: OrmFindOptionsRelations<EntityType>;

    /**
     * Ad-hoc joins mapped onto properties of the entity, for related
     * rows that are not declared relations (composite predicates,
     * filtered loads). Compiled into the same SQL statement as the
     * find, so they add no extra database round trips.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    joins?: ReadonlyArray<OrmMappedJoin<any>>;

    /**
     * Order, in which entities should be ordered.
     */
    order?: OrmFindOptionsOrder<EntityType>;
}
