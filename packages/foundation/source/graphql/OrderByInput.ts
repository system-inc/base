// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrderByDirection } from '@system-inc/base-common/graphql/OrderByDirection';
import { OrderByInput as OrderByInputInterface } from '@system-inc/base-common/graphql/OrderByInput';
import { Dictionary } from '@system-inc/base-common/type/Dictionary';
import { OrmFindOptionsOrder } from '../orm/interfaces/find/OrmFindOptionsOrder';
import { GqlField } from './decorators/GqlField';
import { GqlInputType } from './decorators/GqlInputType';
import { gqlRegisterEnumType } from './types/GqlRegisterEnumType';

gqlRegisterEnumType(OrderByDirection, {
    name: 'OrderByDirection',
    description: 'The order direction of a query',
});

@GqlInputType()
export class OrderByInput implements OrderByInputInterface {
    @GqlField(() => String)
    key: string;

    @GqlField(() => OrderByDirection, { nullable: true })
    direction?: OrderByDirection;
}

export type SqlOrderByDirection = 'ASC' | 'DESC';

export function orderByInputToFindOptionsOrder(
    orderBy: OrderByInput | OrderByInput[],
): OrmFindOptionsOrder<object> {
    const orderBys: Dictionary<SqlOrderByDirection> = {};
    if (Array.isArray(orderBy)) {
        for (const order of orderBy) {
            orderBys[order.key] = orderByDirectionToSql(order.direction);
        }
    } else {
        orderBys[orderBy.key] = orderByDirectionToSql(orderBy.direction);
    }
    return orderBys;
}

export function orderByDirectionToSql(
    direction?: OrderByDirection,
): SqlOrderByDirection {
    return direction === OrderByDirection.Ascending ? 'ASC' : 'DESC';
}
