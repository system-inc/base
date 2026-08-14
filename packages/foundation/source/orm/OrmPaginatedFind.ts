// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    DatabaseMaxPageSize,
    DatabasePageSize,
} from '@system-inc/base-common/database/DatabaseConstants';
import { numberClamp } from '@system-inc/base-common/number/Clamp';
import { buildPagination } from '../graphql/BuildPagination';
import { PaginationResult } from '../graphql/PaginationResult';
import { OrmTrackingEntity } from './entity/OrmTrackingEntity';
import { OrmFindOptionsWhere } from './interfaces/find/OrmFindOptionsWhere';
import { OrmPaginatedFindOptions } from './OrmPaginatedFindOptions';
import { OrmPaginationInput } from './OrmPaginationInput';

/**
 * Creates a paginated find query for the given entity.
 *
 * Where conditions AND-merge across all sources, with server conditions
 * winning over client filters on key collision:
 * client `pagination.filters` < `pagination.scopeWhere(...)` < `input.where`.
 *
 * Ordering uses the pagination orderBy when present, otherwise
 * `input.order`.
 *
 * @param input
 * @returns
 */
export async function ormPaginatedFind<EntityType extends OrmTrackingEntity>(
    input: OrmPaginatedFindOptions<EntityType>,
): Promise<PaginationResult<EntityType>> {
    // Accept the wire PaginationInput directly: bridge it here so the
    // declared @PaginationInputFor allowlists apply without every
    // resolver repeating OrmPaginationInput.from.
    const pagination =
        input.pagination instanceof OrmPaginationInput ||
        input.pagination === undefined
            ? input.pagination
            : OrmPaginationInput.from(input.pagination);

    const limit = numberClamp(
        pagination?.itemsPerPage ?? DatabasePageSize,
        1,
        DatabaseMaxPageSize,
    );
    const offset = pagination?.itemIndex ?? 0;

    // Client filters (via pagination) and server conditions (scopeWhere
    // and input.where) AND-merge, with the server conditions spread last
    // so a client filter can never override or drop a scope condition.
    // getFindOptionsWhere is object-typed (the class is not generic), so
    // narrow it to the entity's where type before merging.
    const paginationWhere = pagination?.getFindOptionsWhere() as
        | OrmFindOptionsWhere<EntityType>
        | undefined;
    // The spread of two generic mapped types loses its relation to the
    // mapped type, so re-assert it — both operands are already
    // OrmFindOptionsWhere<EntityType>.
    const where =
        paginationWhere || input.where
            ? ({
                  ...paginationWhere,
                  ...input.where,
              } as OrmFindOptionsWhere<EntityType>)
            : undefined;

    // use the pagination orderBy if it exists, otherwise use the input order
    const order = pagination?.getFindOptionsOrder() ?? input.order;

    const [items, itemsTotal] = await input.repository.findAndCount({
        where,
        order,
        limit,
        offset,
        relations: input.relations,
        joins: input.joins,
    });
    return {
        items: items,
        pagination: buildPagination({
            itemsPerPage: limit,
            itemIndex: offset,
            itemsTotal,
            itemsReturned: items.length,
        }),
    };
}
