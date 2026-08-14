// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { GqlField } from './decorators/GqlField';
import { GqlObjectType } from './decorators/GqlObjectType';
import { GqlInteger } from './types/GqlInteger';

@GqlObjectType()
export class Pagination {
    // the index of the first item in the current page
    @GqlField(() => GqlInteger)
    itemIndex: number;

    @GqlField(() => GqlInteger, { nullable: true })
    itemIndexForPreviousPage?: number;

    @GqlField(() => GqlInteger, { nullable: true })
    itemIndexForNextPage?: number;

    @GqlField(() => GqlInteger)
    itemsPerPage: number;

    @GqlField(() => GqlInteger)
    itemsTotal: number;

    @GqlField(() => GqlInteger)
    pagesTotal: number;

    @GqlField(() => GqlInteger)
    page: number;
}

@GqlObjectType()
export abstract class PaginationResult<T> {
    abstract items: T[];

    @GqlField(() => Pagination)
    pagination: Pagination;
}
