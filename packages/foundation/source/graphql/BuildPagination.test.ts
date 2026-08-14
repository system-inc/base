// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { buildPagination } from './BuildPagination';

/**
 * The envelope's boundary arithmetic is exactly what drifts when
 * resolvers hand-assemble it: cursors on first/last pages, one-based
 * page numbers, and the short final page.
 */
describe('buildPagination', () => {
    it('describes a middle page with both cursors', () => {
        const pagination = buildPagination({
            itemsPerPage: 10,
            itemIndex: 10,
            itemsTotal: 35,
            itemsReturned: 10,
        });
        expect(pagination).toEqual({
            itemsTotal: 35,
            pagesTotal: 4,
            itemsPerPage: 10,
            itemIndex: 10,
            itemIndexForNextPage: 20,
            itemIndexForPreviousPage: 0,
            page: 2,
        });
    });

    it('leaves the previous cursor undefined on the first page', () => {
        const pagination = buildPagination({
            itemsPerPage: 10,
            itemIndex: 0,
            itemsTotal: 35,
            itemsReturned: 10,
        });
        expect(pagination.itemIndexForPreviousPage).toBeUndefined();
        expect(pagination.itemIndexForNextPage).toBe(10);
        expect(pagination.page).toBe(1);
    });

    it('advances the next cursor by rows returned, not page size', () => {
        // Short final page: the cursor must not point past the end.
        const pagination = buildPagination({
            itemsPerPage: 10,
            itemIndex: 30,
            itemsTotal: 35,
            itemsReturned: 5,
        });
        expect(pagination.itemIndexForNextPage).toBeUndefined();
        expect(pagination.itemIndexForPreviousPage).toBe(20);
        expect(pagination.page).toBe(4);
    });

    it('a single page has neither cursor', () => {
        const pagination = buildPagination({
            itemsPerPage: 10,
            itemIndex: 0,
            itemsTotal: 4,
            itemsReturned: 4,
        });
        expect(pagination.itemIndexForNextPage).toBeUndefined();
        expect(pagination.itemIndexForPreviousPage).toBeUndefined();
        expect(pagination.pagesTotal).toBe(1);
    });
});
