// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { PaginationInput as PaginationInputInterface } from '@system-inc/base-common/graphql/PaginationInput';
import { ColumnFilterInput } from './ColumnFilter';
import { GqlField } from './decorators/GqlField';
import { GqlInputType } from './decorators/GqlInputType';
import { OrderByInput } from './OrderByInput';
import { GqlInteger } from './types/GqlInteger';

/**
 * Plain pagination: page size and index, nothing else. The bare type
 * deliberately exposes NO `filters`/`orderBy` fields in the schema —
 * client-driven filtering and ordering are opt-in per operation via a
 * `@PaginationInputFor` subclass, which re-registers those fields typed
 * with the operation's allowed columns. The properties still exist on
 * the class (untyped, schema-invisible) so subclasses inherit them and
 * server-side code can build pagination programmatically.
 */
@GqlInputType()
export class PaginationInput implements PaginationInputInterface {
    @GqlField(() => GqlInteger)
    itemsPerPage: number;

    @GqlField(() => GqlInteger, { nullable: true })
    itemIndex?: number;

    filters?: ColumnFilterInput[];

    orderBy?: OrderByInput[];

    addFilter(filter: ColumnFilterInput) {
        if (!this.filters) {
            this.filters = [];
        }
        this.filters.push(filter);
    }

    addOrderBy(orderBy: OrderByInput) {
        if (!this.orderBy) {
            this.orderBy = [];
        }
        this.orderBy.push(orderBy);
    }
}
