// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ColumnFilterConditionOperator } from '@system-inc/base-common/graphql/ColumnFilterConditionOperator';
import { OrderByDirection } from '@system-inc/base-common/graphql/OrderByDirection';
import { ColumnFilterInput } from './ColumnFilter';
import { OrderByInput } from './OrderByInput';
import { PaginationInput } from './PaginationInput';

describe('PaginationInput', () => {
    describe('class instantiation and basic properties', () => {
        it('should create PaginationInput with required itemsPerPage', () => {
            const pagination = new PaginationInput();
            pagination.itemsPerPage = 10;

            expect(pagination.itemsPerPage).toBe(10);
            expect(pagination.itemIndex).toBeUndefined();
            expect(pagination.filters).toBeUndefined();
            expect(pagination.orderBy).toBeUndefined();
        });

        it('should create PaginationInput with all properties', () => {
            const pagination = new PaginationInput();
            pagination.itemsPerPage = 25;
            pagination.itemIndex = 50;

            expect(pagination.itemsPerPage).toBe(25);
            expect(pagination.itemIndex).toBe(50);
        });

        it('should handle zero itemIndex', () => {
            const pagination = new PaginationInput();
            pagination.itemsPerPage = 20;
            pagination.itemIndex = 0;

            expect(pagination.itemIndex).toBe(0);
        });
    });

    describe('addFilter method', () => {
        it('should add filter to empty filters array', () => {
            const pagination = new PaginationInput();
            pagination.itemsPerPage = 10;

            const filter = new ColumnFilterInput();
            filter.column = 'name';
            filter.operator = ColumnFilterConditionOperator.Equal;
            filter.value = 'test';

            pagination.addFilter(filter);

            expect(pagination.filters).toHaveLength(1);
            expect(pagination.filters![0]).toBe(filter);
        });

        it('should add multiple filters to array', () => {
            const pagination = new PaginationInput();
            pagination.itemsPerPage = 10;

            const filter1 = new ColumnFilterInput();
            filter1.column = 'name';
            filter1.operator = ColumnFilterConditionOperator.Equal;
            filter1.value = 'test';

            const filter2 = new ColumnFilterInput();
            filter2.column = 'status';
            filter2.operator = ColumnFilterConditionOperator.Equal;
            filter2.value = 'active';

            pagination.addFilter(filter1);
            pagination.addFilter(filter2);

            expect(pagination.filters).toHaveLength(2);
            expect(pagination.filters![0]).toBe(filter1);
            expect(pagination.filters![1]).toBe(filter2);
        });

        it('should add filter to existing filters array', () => {
            const pagination = new PaginationInput();
            pagination.itemsPerPage = 10;

            const existingFilter = new ColumnFilterInput();
            existingFilter.column = 'existing';
            existingFilter.operator = ColumnFilterConditionOperator.Equal;
            existingFilter.value = 'value';
            pagination.filters = [existingFilter];

            const newFilter = new ColumnFilterInput();
            newFilter.column = 'new';
            newFilter.operator = ColumnFilterConditionOperator.NotEqual;
            newFilter.value = 'value2';

            pagination.addFilter(newFilter);

            expect(pagination.filters).toHaveLength(2);
            expect(pagination.filters![0]).toBe(existingFilter);
            expect(pagination.filters![1]).toBe(newFilter);
        });
    });

    describe('addOrderBy method', () => {
        it('should add orderBy to empty orderBy array', () => {
            const pagination = new PaginationInput();
            pagination.itemsPerPage = 10;

            const orderBy = new OrderByInput();
            orderBy.key = 'name';
            orderBy.direction = OrderByDirection.Ascending;

            pagination.addOrderBy(orderBy);

            expect(pagination.orderBy).toHaveLength(1);
            expect(pagination.orderBy![0]).toBe(orderBy);
        });

        it('should add multiple orderBy items to array', () => {
            const pagination = new PaginationInput();
            pagination.itemsPerPage = 10;

            const orderBy1 = new OrderByInput();
            orderBy1.key = 'name';
            orderBy1.direction = OrderByDirection.Ascending;

            const orderBy2 = new OrderByInput();
            orderBy2.key = 'createdAt';
            orderBy2.direction = OrderByDirection.Descending;

            pagination.addOrderBy(orderBy1);
            pagination.addOrderBy(orderBy2);

            expect(pagination.orderBy).toHaveLength(2);
            expect(pagination.orderBy![0]).toBe(orderBy1);
            expect(pagination.orderBy![1]).toBe(orderBy2);
        });

        it('should add orderBy to existing orderBy array', () => {
            const pagination = new PaginationInput();
            pagination.itemsPerPage = 10;

            const existingOrderBy = new OrderByInput();
            existingOrderBy.key = 'existing';
            existingOrderBy.direction = OrderByDirection.Ascending;
            pagination.orderBy = [existingOrderBy];

            const newOrderBy = new OrderByInput();
            newOrderBy.key = 'new';
            newOrderBy.direction = OrderByDirection.Descending;

            pagination.addOrderBy(newOrderBy);

            expect(pagination.orderBy).toHaveLength(2);
            expect(pagination.orderBy![0]).toBe(existingOrderBy);
            expect(pagination.orderBy![1]).toBe(newOrderBy);
        });
    });
});
