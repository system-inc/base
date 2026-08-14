// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ColumnFilterConditionOperator } from '@system-inc/base-common/graphql/ColumnFilterConditionOperator';
import { OrderByDirection } from '@system-inc/base-common/graphql/OrderByDirection';
import { ArgumentValidationError } from '../error/ArgumentValidationError';
import { ColumnFilterInput } from '../graphql/ColumnFilter';
import { OrderByInput } from '../graphql/OrderByInput';
import { OrmFindOptionsOrder } from './interfaces/find/OrmFindOptionsOrder';
import { OrmFindOptionsWhere } from './interfaces/find/OrmFindOptionsWhere';
import { OrmPaginationInput } from './OrmPaginationInput';

describe('OrmPaginationInput', () => {
    describe('class instantiation and basic properties', () => {
        it('should create OrmPaginationInput with required itemsPerPage', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;

            expect(pagination.itemsPerPage).toBe(10);
            expect(pagination.itemIndex).toBeUndefined();
            expect(pagination.filters).toBeUndefined();
            expect(pagination.orderBy).toBeUndefined();
        });

        it('should create OrmPaginationInput with all properties', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 25;
            pagination.itemIndex = 50;

            expect(pagination.itemsPerPage).toBe(25);
            expect(pagination.itemIndex).toBe(50);
        });

        it('should handle zero itemIndex', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 20;
            pagination.itemIndex = 0;

            expect(pagination.itemIndex).toBe(0);
        });
    });

    describe('addFilter method', () => {
        it('should add filter to empty filters array', () => {
            const pagination = new OrmPaginationInput();
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
            const pagination = new OrmPaginationInput();
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
            const pagination = new OrmPaginationInput();
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
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;

            const orderBy = new OrderByInput();
            orderBy.key = 'name';
            orderBy.direction = OrderByDirection.Ascending;

            pagination.addOrderBy(orderBy);

            expect(pagination.orderBy).toHaveLength(1);
            expect(pagination.orderBy![0]).toBe(orderBy);
        });

        it('should add multiple orderBy items to array', () => {
            const pagination = new OrmPaginationInput();
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
            const pagination = new OrmPaginationInput();
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

    describe('scopeWhere method', () => {
        it('should set initial scope conditions when none exist', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;

            const conditions: OrmFindOptionsWhere<object> = { id: 1 };
            pagination.scopeWhere(conditions);

            const result = pagination.getFindOptionsWhere();
            expect(result).toEqual({ id: 1 });
        });

        it('should AND-merge scope conditions across calls', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;

            pagination.scopeWhere({ status: 'active' });
            pagination.scopeWhere({ type: 'user' });

            const result = pagination.getFindOptionsWhere();
            expect(result).toEqual({ status: 'active', type: 'user' });
        });

        it('should let a later scope call win on key collision', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;

            pagination.scopeWhere({ status: 'active' });
            pagination.scopeWhere({ status: 'pending' });

            const result = pagination.getFindOptionsWhere();
            expect(result).toEqual({ status: 'pending' });
        });
    });

    describe('addFindOptionsOrder method', () => {
        it('should set initial order options when none exist', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;

            const orderOptions: OrmFindOptionsOrder<object> = { name: 'ASC' };
            pagination.addFindOptionsOrder(orderOptions);

            const result = pagination.getFindOptionsOrder();
            expect(result).toEqual({ name: 'ASC' });
        });

        it('should merge order options when existing options exist', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;

            const initialOrder: OrmFindOptionsOrder<object> = { name: 'ASC' };
            pagination.addFindOptionsOrder(initialOrder);

            const additionalOrder: OrmFindOptionsOrder<object> = {
                createdAt: 'DESC',
            };
            pagination.addFindOptionsOrder(additionalOrder);

            const result = pagination.getFindOptionsOrder();
            expect(result).toEqual({ name: 'ASC', createdAt: 'DESC' });
        });

        it('should override existing keys with new values', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;

            const initialOrder: OrmFindOptionsOrder<object> = {
                name: 'ASC',
                status: 'DESC',
            };
            pagination.addFindOptionsOrder(initialOrder);

            const overridingOrder: OrmFindOptionsOrder<object> = {
                name: 'DESC',
            };
            pagination.addFindOptionsOrder(overridingOrder);

            const result = pagination.getFindOptionsOrder();
            expect(result).toEqual({ name: 'DESC', status: 'DESC' });
        });
    });

    describe('getFindOptionsWhere method', () => {
        it('should return undefined when no filters or find options', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;

            const result = pagination.getFindOptionsWhere();
            expect(result).toBeUndefined();
        });

        it('should return scope conditions when no filters but scope exists', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;

            pagination.scopeWhere({ status: 'active' });

            const result = pagination.getFindOptionsWhere();
            expect(result).toEqual({ status: 'active' });
        });

        it('should return allowlisted filter operators when no scope but filters exist', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;
            pagination.allowFilterColumns(['name']);

            const filter = new ColumnFilterInput();
            filter.column = 'name';
            filter.operator = ColumnFilterConditionOperator.Equal;
            filter.value = 'test';
            pagination.addFilter(filter);

            const result = pagination.getFindOptionsWhere();
            expect(result).toEqual({ name: 'test' });
        });

        it('should AND-merge allowlisted client filters with scope conditions', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;
            pagination.allowFilterColumns(['name']);

            pagination.scopeWhere({ status: 'active' });

            const filter = new ColumnFilterInput();
            filter.column = 'name';
            filter.operator = ColumnFilterConditionOperator.Equal;
            filter.value = 'test';
            pagination.addFilter(filter);

            const result = pagination.getFindOptionsWhere();
            expect(result).toEqual({ status: 'active', name: 'test' });
        });

        it('scope conditions must win over an allowlisted client filter on the same column', () => {
            // Security invariant: even when the column is filterable, a
            // client filter can never override a server-mandated scope.
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;
            pagination.allowFilterColumns(['emailAddress']);

            const maliciousFilter = new ColumnFilterInput();
            maliciousFilter.column = 'emailAddress';
            maliciousFilter.operator = ColumnFilterConditionOperator.Equal;
            maliciousFilter.value = 'victim@example.com';
            pagination.addFilter(maliciousFilter);

            pagination.scopeWhere({ emailAddress: 'owner@example.com' });

            const result = pagination.getFindOptionsWhere();
            expect(result).toEqual({ emailAddress: 'owner@example.com' });
        });

        it('scope wins regardless of whether it was added before the filter', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;
            pagination.allowFilterColumns(['emailAddress']);

            pagination.scopeWhere({ emailAddress: 'owner@example.com' });

            const maliciousFilter = new ColumnFilterInput();
            maliciousFilter.column = 'emailAddress';
            maliciousFilter.operator = ColumnFilterConditionOperator.Equal;
            maliciousFilter.value = 'victim@example.com';
            pagination.addFilter(maliciousFilter);

            const result = pagination.getFindOptionsWhere();
            expect(result).toEqual({ emailAddress: 'owner@example.com' });
        });
    });

    describe('client filter allowlist (fail closed)', () => {
        function equalFilter(column: string, value: string): ColumnFilterInput {
            const filter = new ColumnFilterInput();
            filter.column = column;
            filter.operator = ColumnFilterConditionOperator.Equal;
            filter.value = value;
            return filter;
        }

        it('rejects client filters when no allowlist is set', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;
            pagination.addFilter(equalFilter('deletedAt', 'probe'));

            // Fail closed AND loud: a resolver that never opted in cannot
            // be filter-injected — and a filter the server won't honor is
            // rejected rather than silently dropped, which would return a
            // broader result set than the client asked for.
            let thrown: unknown;
            try {
                pagination.getFindOptionsWhere();
            } catch (error) {
                thrown = error;
            }
            expect(thrown).toBeInstanceOf(ArgumentValidationError);
            // Distinct constraint from the column-not-permitted error so the
            // two failure modes are distinguishable.
            const serialized = JSON.stringify(
                (thrown as ArgumentValidationError).extensions,
            );
            expect(serialized).toContain('does not accept filters');
            expect(serialized).toContain('isFilterable');
        });

        it('rejects filters without an allowlist even when scope is set', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;
            pagination.scopeWhere({ status: 'active' });
            pagination.addFilter(equalFilter('secretFlag', 'x'));

            expect(() => pagination.getFindOptionsWhere()).toThrow(
                ArgumentValidationError,
            );
        });

        it('an empty filters array is plain pagination, not a rejection', () => {
            const pagination = OrmPaginationInput.from({
                itemsPerPage: 10,
                filters: [],
            });
            expect(pagination.getFindOptionsWhere()).toBeUndefined();

            pagination.scopeWhere({ status: 'active' });
            expect(pagination.getFindOptionsWhere()).toEqual({
                status: 'active',
            });
        });

        it('two filters on the same column AND together (range), not last-wins', () => {
            // Audit finding 7: gte+lte on one column used to collapse to
            // just the lte via object spread, silently dropping the lower
            // bound and over-returning rows.
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;
            pagination.allowFilterColumns(['createdAt']);

            const fromFilter = new ColumnFilterInput();
            fromFilter.column = 'createdAt';
            fromFilter.operator =
                ColumnFilterConditionOperator.GreaterThanOrEqual;
            fromFilter.value = '2026-01-01';
            pagination.addFilter(fromFilter);

            const toFilter = new ColumnFilterInput();
            toFilter.column = 'createdAt';
            toFilter.operator = ColumnFilterConditionOperator.LessThanOrEqual;
            toFilter.value = '2026-02-01';
            pagination.addFilter(toFilter);

            expect(pagination.getFindOptionsWhere()).toEqual({
                createdAt: {
                    type: 'and',
                    value: [
                        { type: 'gte', value: '2026-01-01' },
                        { type: 'lte', value: '2026-02-01' },
                    ],
                },
            });
        });

        it('applies a client filter on an allowlisted column', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;
            pagination.allowFilterColumns(['name', 'status']);
            pagination.addFilter(equalFilter('name', 'widget'));

            expect(pagination.getFindOptionsWhere()).toEqual({
                name: 'widget',
            });
        });

        it('throws when a client filter names a column outside the allowlist', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;
            pagination.allowFilterColumns(['name']);
            pagination.addFilter(equalFilter('name', 'widget'));
            pagination.addFilter(equalFilter('internalCost', '0'));

            let thrown: unknown;
            try {
                pagination.getFindOptionsWhere();
            } catch (error) {
                thrown = error;
            }
            expect(thrown).toBeInstanceOf(ArgumentValidationError);
            // The rejected column is named in the structured validation error.
            const serialized = JSON.stringify(
                (thrown as ArgumentValidationError).extensions,
            );
            expect(serialized).toContain('internalCost');
        });
    });

    describe('getFindOptionsOrder method', () => {
        it('should return undefined when no orderBy or find options order', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;

            const result = pagination.getFindOptionsOrder();
            expect(result).toBeUndefined();
        });

        it('should return find options order when no orderBy but order exists', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;

            const orderOptions: OrmFindOptionsOrder<object> = { name: 'ASC' };
            pagination.addFindOptionsOrder(orderOptions);

            const result = pagination.getFindOptionsOrder();
            expect(result).toEqual({ name: 'ASC' });
        });

        it('should return allowlisted orderBy converted to find options when no find options order', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;
            pagination.allowOrderColumns(['name']);

            const orderBy = new OrderByInput();
            orderBy.key = 'name';
            orderBy.direction = OrderByDirection.Ascending;
            pagination.addOrderBy(orderBy);

            const result = pagination.getFindOptionsOrder();
            expect(result).toEqual({ name: 'ASC' });
        });

        it('should merge allowlisted orderBy with existing find options order', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;
            pagination.allowOrderColumns(['name']);

            const orderOptions: OrmFindOptionsOrder<object> = {
                status: 'DESC',
            };
            pagination.addFindOptionsOrder(orderOptions);

            const orderBy = new OrderByInput();
            orderBy.key = 'name';
            orderBy.direction = OrderByDirection.Ascending;
            pagination.addOrderBy(orderBy);

            const result = pagination.getFindOptionsOrder();
            expect(result).toEqual({ status: 'DESC', name: 'ASC' });
        });

        it('a vetted client orderBy overrides the server default on the same key', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;
            pagination.allowOrderColumns(['name']);

            const orderOptions: OrmFindOptionsOrder<object> = {
                name: 'DESC',
                status: 'ASC',
            };
            pagination.addFindOptionsOrder(orderOptions);

            const orderBy = new OrderByInput();
            orderBy.key = 'name';
            orderBy.direction = OrderByDirection.Ascending;
            pagination.addOrderBy(orderBy);

            const result = pagination.getFindOptionsOrder();
            expect(result).toEqual({ name: 'ASC', status: 'ASC' });
        });
    });

    describe('client orderBy allowlist (fail closed)', () => {
        function orderByOn(key: string): OrderByInput {
            const orderBy = new OrderByInput();
            orderBy.key = key;
            orderBy.direction = OrderByDirection.Ascending;
            return orderBy;
        }

        it('rejects client orderBy when no order allowlist is set', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;
            pagination.addOrderBy(orderByOn('internalCost'));

            let thrown: unknown;
            try {
                pagination.getFindOptionsOrder();
            } catch (error) {
                thrown = error;
            }
            expect(thrown).toBeInstanceOf(ArgumentValidationError);
            const serialized = JSON.stringify(
                (thrown as ArgumentValidationError).extensions,
            );
            expect(serialized).toContain('does not accept ordering');
            expect(serialized).toContain('isOrderable');
        });

        it('rejects an orderBy key outside the allowlist, naming the column', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;
            pagination.allowOrderColumns(['createdAt']);
            pagination.addOrderBy(orderByOn('createdAt'));
            pagination.addOrderBy(orderByOn('secretScore'));

            let thrown: unknown;
            try {
                pagination.getFindOptionsOrder();
            } catch (error) {
                thrown = error;
            }
            expect(thrown).toBeInstanceOf(ArgumentValidationError);
            const serialized = JSON.stringify(
                (thrown as ArgumentValidationError).extensions,
            );
            expect(serialized).toContain('secretScore');
        });

        it('client orderBy leads the merged order — position is the semantics', () => {
            // Audit finding 11: the client sort used to be appended AFTER
            // the server default, demoting it to an inert tiebreaker.
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;
            pagination.allowOrderColumns(['name']);
            pagination.addFindOptionsOrder({ createdAt: 'DESC' });
            pagination.addOrderBy(orderByOn('name'));

            const order = pagination.getFindOptionsOrder()!;
            expect(Object.keys(order)).toEqual(['name', 'createdAt']);
            expect(order).toEqual({ name: 'ASC', createdAt: 'DESC' });
        });

        it('server-set order is unaffected by the missing allowlist', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;
            pagination.addFindOptionsOrder({ createdAt: 'DESC' });

            expect(pagination.getFindOptionsOrder()).toEqual({
                createdAt: 'DESC',
            });
        });
    });

    describe('complex integration scenarios', () => {
        it('should handle complete pagination setup', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 20;
            pagination.itemIndex = 40;
            pagination.allowFilterColumns(['status', 'type']);
            pagination.allowOrderColumns(['name', 'createdAt']);

            // Add filters
            const filter1 = new ColumnFilterInput();
            filter1.column = 'status';
            filter1.operator = ColumnFilterConditionOperator.Equal;
            filter1.value = 'active';
            pagination.addFilter(filter1);

            const filter2 = new ColumnFilterInput();
            filter2.column = 'type';
            filter2.operator = ColumnFilterConditionOperator.In;
            filter2.value = ['user', 'admin'];
            pagination.addFilter(filter2);

            // Add orderBy
            const orderBy1 = new OrderByInput();
            orderBy1.key = 'name';
            orderBy1.direction = OrderByDirection.Ascending;
            pagination.addOrderBy(orderBy1);

            const orderBy2 = new OrderByInput();
            orderBy2.key = 'createdAt';
            orderBy2.direction = OrderByDirection.Descending;
            pagination.addOrderBy(orderBy2);

            // Add scope conditions
            const findOptions: OrmFindOptionsWhere<object> = {
                deletedAt: null,
            };
            pagination.scopeWhere(findOptions);

            const orderOptions: OrmFindOptionsOrder<object> = {
                priority: 'ASC',
            };
            pagination.addFindOptionsOrder(orderOptions);

            expect(pagination.itemsPerPage).toBe(20);
            expect(pagination.itemIndex).toBe(40);

            const whereResult = pagination.getFindOptionsWhere();
            expect(whereResult).toEqual({
                deletedAt: null,
                status: 'active',
                type: { type: 'in', value: ['user', 'admin'] },
            });

            const orderResult = pagination.getFindOptionsOrder();
            expect(orderResult).toEqual({
                priority: 'ASC',
                name: 'ASC',
                createdAt: 'DESC',
            });
        });

        it('should combine scope conditions with multiple filters', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 15;
            pagination.allowFilterColumns(['status']);

            pagination.scopeWhere({ role: 'admin' });

            const filter = new ColumnFilterInput();
            filter.column = 'status';
            filter.operator = ColumnFilterConditionOperator.Equal;
            filter.value = 'active';
            pagination.addFilter(filter);

            const result = pagination.getFindOptionsWhere();
            expect(result).toEqual({ status: 'active', role: 'admin' });
        });

        it('should handle multiple filter types', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;
            pagination.allowFilterColumns(['status', 'name', 'age']);

            // Add various filter types
            const equalFilter = new ColumnFilterInput();
            equalFilter.column = 'status';
            equalFilter.operator = ColumnFilterConditionOperator.Equal;
            equalFilter.value = 'active';
            pagination.addFilter(equalFilter);

            const likeFilter = new ColumnFilterInput();
            likeFilter.column = 'name';
            likeFilter.operator = ColumnFilterConditionOperator.Like;
            likeFilter.value = '%test%';
            pagination.addFilter(likeFilter);

            const greaterThanFilter = new ColumnFilterInput();
            greaterThanFilter.column = 'age';
            greaterThanFilter.operator =
                ColumnFilterConditionOperator.GreaterThan;
            greaterThanFilter.value = 18;
            pagination.addFilter(greaterThanFilter);

            const result = pagination.getFindOptionsWhere();
            expect(result).toEqual({
                status: 'active',
                name: { type: 'like', pattern: '%test%' },
                age: { type: 'gt', value: 18 },
            });
        });

        it('should handle empty states correctly', () => {
            const pagination = new OrmPaginationInput();
            pagination.itemsPerPage = 10;

            expect(pagination.getFindOptionsWhere()).toBeUndefined();
            expect(pagination.getFindOptionsOrder()).toBeUndefined();
            expect(pagination.filters).toBeUndefined();
            expect(pagination.orderBy).toBeUndefined();
        });
    });
});
