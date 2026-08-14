// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { Pagination } from './PaginationResult';

/**
 * Builds the `Pagination` a paginated result carries.
 *
 * `ormPaginatedFind` covers every read that is a find over an entity, which is
 * nearly all of them. A handful of resolvers cannot use it - a GROUP BY has no
 * entity to find, and a hand-written join may not map to one - and those have to
 * assemble this object themselves. Doing that by hand is how the shape drifts:
 * one existing resolver computes a zero-based `page` where the find layer
 * computes it one-based, and none of them populate the next/previous cursors at
 * all, so a client cannot tell those results apart from a single-page one.
 *
 * So the arithmetic lives here and both paths call it. A resolver still runs its
 * own `LIMIT`/`OFFSET` and its own `COUNT`; it just does not get to invent what
 * the numbers around them mean.
 */
export function buildPagination(input: {
    /** Rows the query asked for. */
    itemsPerPage: number;
    /** Offset the query ran at. */
    itemIndex: number;
    /** Rows matching the query ignoring limit and offset. */
    itemsTotal: number;
    /**
     * Rows actually returned. The cursor has to advance by what came back, not
     * by the page size, or a short final page points past the end.
     */
    itemsReturned: number;
}): Pagination {
    const { itemsPerPage, itemIndex, itemsTotal, itemsReturned } = input;

    return {
        itemsTotal,
        pagesTotal: itemsPerPage > 0 ? Math.ceil(itemsTotal / itemsPerPage) : 0,
        itemsPerPage,
        itemIndex,
        itemIndexForNextPage:
            itemIndex + itemsReturned < itemsTotal
                ? itemIndex + itemsReturned
                : undefined,
        itemIndexForPreviousPage:
            itemIndex === 0 ? undefined : Math.max(itemIndex - itemsPerPage, 0),
        // One-based, matching the find layer. `itemIndex` is the zero-based
        // offset; `page` is what a human counts.
        page: itemsPerPage > 0 ? Math.floor(itemIndex / itemsPerPage) + 1 : 0,
    };
}
