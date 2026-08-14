// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrderByDirection } from '@system-inc/base-common/graphql/OrderByDirection';
import { OrmFindOptionsOrder } from '../orm/interfaces/find/OrmFindOptionsOrder';
import {
    orderByDirectionToSql,
    OrderByInput,
    orderByInputToFindOptionsOrder,
    SqlOrderByDirection,
} from './OrderByInput';

describe('OrderByInput', () => {
    describe('OrderByInput class', () => {
        it('should create OrderByInput with required key field', () => {
            const orderBy = new OrderByInput();
            orderBy.key = 'name';

            expect(orderBy.key).toBe('name');
            expect(orderBy.direction).toBeUndefined();
        });

        it('should create OrderByInput with key and direction', () => {
            const orderBy = new OrderByInput();
            orderBy.key = 'createdAt';
            orderBy.direction = OrderByDirection.Descending;

            expect(orderBy.key).toBe('createdAt');
            expect(orderBy.direction).toBe(OrderByDirection.Descending);
        });

        it('should create OrderByInput with ascending direction', () => {
            const orderBy = new OrderByInput();
            orderBy.key = 'price';
            orderBy.direction = OrderByDirection.Ascending;

            expect(orderBy.key).toBe('price');
            expect(orderBy.direction).toBe(OrderByDirection.Ascending);
        });
    });

    describe('orderByDirectionToSql', () => {
        it('should return ASC for Ascending direction', () => {
            const result = orderByDirectionToSql(OrderByDirection.Ascending);
            expect(result).toBe('ASC');
        });

        it('should return DESC for Descending direction', () => {
            const result = orderByDirectionToSql(OrderByDirection.Descending);
            expect(result).toBe('DESC');
        });

        it('should return DESC for undefined direction (default)', () => {
            const result = orderByDirectionToSql(undefined);
            expect(result).toBe('DESC');
        });

        it('should return DESC for null direction', () => {
            const result = orderByDirectionToSql(
                null as unknown as OrderByDirection,
            );
            expect(result).toBe('DESC');
        });

        it('should have correct SqlOrderByDirection type', () => {
            const result: SqlOrderByDirection = orderByDirectionToSql(
                OrderByDirection.Ascending,
            );
            expect(result).toBe('ASC');

            const result2: SqlOrderByDirection = orderByDirectionToSql(
                OrderByDirection.Descending,
            );
            expect(result2).toBe('DESC');
        });
    });

    describe('orderByInputToFindOptionsOrder', () => {
        describe('single OrderByInput', () => {
            it('should convert single OrderByInput with Ascending direction', () => {
                const orderBy = new OrderByInput();
                orderBy.key = 'name';
                orderBy.direction = OrderByDirection.Ascending;

                const result = orderByInputToFindOptionsOrder(orderBy);
                expect(result).toEqual({ name: 'ASC' });
            });

            it('should convert single OrderByInput with Descending direction', () => {
                const orderBy = new OrderByInput();
                orderBy.key = 'createdAt';
                orderBy.direction = OrderByDirection.Descending;

                const result = orderByInputToFindOptionsOrder(orderBy);
                expect(result).toEqual({ createdAt: 'DESC' });
            });

            it('should convert single OrderByInput with undefined direction to DESC', () => {
                const orderBy = new OrderByInput();
                orderBy.key = 'price';
                // direction is undefined

                const result = orderByInputToFindOptionsOrder(orderBy);
                expect(result).toEqual({ price: 'DESC' });
            });

            it('should handle special characters in key names', () => {
                const orderBy = new OrderByInput();
                orderBy.key = 'user_name';
                orderBy.direction = OrderByDirection.Ascending;

                const result = orderByInputToFindOptionsOrder(orderBy);
                expect(result).toEqual({ user_name: 'ASC' });
            });

            it('should handle nested property key names', () => {
                const orderBy = new OrderByInput();
                orderBy.key = 'user.profile.name';
                orderBy.direction = OrderByDirection.Descending;

                const result = orderByInputToFindOptionsOrder(orderBy);
                expect(result).toEqual({ 'user.profile.name': 'DESC' });
            });
        });

        describe('array of OrderByInput', () => {
            it('should convert array with single OrderByInput', () => {
                const orderBy = new OrderByInput();
                orderBy.key = 'name';
                orderBy.direction = OrderByDirection.Ascending;

                const result = orderByInputToFindOptionsOrder([orderBy]);
                expect(result).toEqual({ name: 'ASC' });
            });

            it('should convert array with multiple OrderByInput items', () => {
                const orderBy1 = new OrderByInput();
                orderBy1.key = 'name';
                orderBy1.direction = OrderByDirection.Ascending;

                const orderBy2 = new OrderByInput();
                orderBy2.key = 'createdAt';
                orderBy2.direction = OrderByDirection.Descending;

                const result = orderByInputToFindOptionsOrder([
                    orderBy1,
                    orderBy2,
                ]);
                expect(result).toEqual({
                    name: 'ASC',
                    createdAt: 'DESC',
                });
            });

            it('should convert array with mixed defined and undefined directions', () => {
                const orderBy1 = new OrderByInput();
                orderBy1.key = 'priority';
                orderBy1.direction = OrderByDirection.Ascending;

                const orderBy2 = new OrderByInput();
                orderBy2.key = 'updatedAt';
                // direction is undefined

                const orderBy3 = new OrderByInput();
                orderBy3.key = 'status';
                orderBy3.direction = OrderByDirection.Descending;

                const result = orderByInputToFindOptionsOrder([
                    orderBy1,
                    orderBy2,
                    orderBy3,
                ]);
                expect(result).toEqual({
                    priority: 'ASC',
                    updatedAt: 'DESC', // defaults to DESC
                    status: 'DESC',
                });
            });

            it('should handle empty array', () => {
                const result = orderByInputToFindOptionsOrder([]);
                expect(result).toEqual({});
            });

            it('should handle duplicate keys (last one wins)', () => {
                const orderBy1 = new OrderByInput();
                orderBy1.key = 'name';
                orderBy1.direction = OrderByDirection.Ascending;

                const orderBy2 = new OrderByInput();
                orderBy2.key = 'name';
                orderBy2.direction = OrderByDirection.Descending;

                const result = orderByInputToFindOptionsOrder([
                    orderBy1,
                    orderBy2,
                ]);
                expect(result).toEqual({ name: 'DESC' }); // last one wins
            });

            it('should handle large number of order fields', () => {
                const orderByItems: OrderByInput[] = [];
                const expected: Record<string, SqlOrderByDirection> = {};

                for (let i = 0; i < 10; i++) {
                    const orderBy = new OrderByInput();
                    orderBy.key = `field${i}`;
                    orderBy.direction =
                        i % 2 === 0
                            ? OrderByDirection.Ascending
                            : OrderByDirection.Descending;
                    orderByItems.push(orderBy);
                    expected[`field${i}`] = i % 2 === 0 ? 'ASC' : 'DESC';
                }

                const result = orderByInputToFindOptionsOrder(orderByItems);
                expect(result).toEqual(expected);
            });
        });

        describe('type compatibility', () => {
            it('should return correct OrmFindOptionsOrder type', () => {
                const orderBy = new OrderByInput();
                orderBy.key = 'name';
                orderBy.direction = OrderByDirection.Ascending;

                const result = orderByInputToFindOptionsOrder(orderBy);

                // This should compile without errors if types are correct
                const ormOrder: OrmFindOptionsOrder<object> = result;
                expect(ormOrder).toEqual({ name: 'ASC' });
            });

            it('should work with complex key structures', () => {
                const orderBy1 = new OrderByInput();
                orderBy1.key = 'user.profile.firstName';
                orderBy1.direction = OrderByDirection.Ascending;

                const orderBy2 = new OrderByInput();
                orderBy2.key = 'posts.createdAt';
                orderBy2.direction = OrderByDirection.Descending;

                const result = orderByInputToFindOptionsOrder([
                    orderBy1,
                    orderBy2,
                ]);
                expect(result).toEqual({
                    'user.profile.firstName': 'ASC',
                    'posts.createdAt': 'DESC',
                });
            });
        });
    });

    describe('SqlOrderByDirection type', () => {
        it('should accept ASC value', () => {
            const direction: SqlOrderByDirection = 'ASC';
            expect(direction).toBe('ASC');
        });

        it('should accept DESC value', () => {
            const direction: SqlOrderByDirection = 'DESC';
            expect(direction).toBe('DESC');
        });

        it('should be compatible with orderByDirectionToSql return type', () => {
            const direction1: SqlOrderByDirection = orderByDirectionToSql(
                OrderByDirection.Ascending,
            );
            const direction2: SqlOrderByDirection = orderByDirectionToSql(
                OrderByDirection.Descending,
            );

            expect(direction1).toBe('ASC');
            expect(direction2).toBe('DESC');
        });
    });

    describe('integration scenarios', () => {
        it('should handle real-world sorting scenario', () => {
            // Scenario: Sort by priority (ascending), then by createdAt (descending)
            const orderBy1 = new OrderByInput();
            orderBy1.key = 'priority';
            orderBy1.direction = OrderByDirection.Ascending;

            const orderBy2 = new OrderByInput();
            orderBy2.key = 'createdAt';
            orderBy2.direction = OrderByDirection.Descending;

            const result = orderByInputToFindOptionsOrder([orderBy1, orderBy2]);
            expect(result).toEqual({
                priority: 'ASC',
                createdAt: 'DESC',
            });
        });

        it('should handle table join sorting scenario', () => {
            // Scenario: Sort by related entity fields
            const orderBy1 = new OrderByInput();
            orderBy1.key = 'user.name';
            orderBy1.direction = OrderByDirection.Ascending;

            const orderBy2 = new OrderByInput();
            orderBy2.key = 'category.displayOrder';
            orderBy2.direction = OrderByDirection.Ascending;

            const orderBy3 = new OrderByInput();
            orderBy3.key = 'createdAt';
            orderBy3.direction = OrderByDirection.Descending;

            const result = orderByInputToFindOptionsOrder([
                orderBy1,
                orderBy2,
                orderBy3,
            ]);
            expect(result).toEqual({
                'user.name': 'ASC',
                'category.displayOrder': 'ASC',
                createdAt: 'DESC',
            });
        });

        it('should handle default sorting when no direction specified', () => {
            // Scenario: User provides field but no direction preference
            const orderBy1 = new OrderByInput();
            orderBy1.key = 'name';
            // No direction specified - should default to DESC

            const orderBy2 = new OrderByInput();
            orderBy2.key = 'id';
            orderBy2.direction = OrderByDirection.Ascending;

            const result = orderByInputToFindOptionsOrder([orderBy1, orderBy2]);
            expect(result).toEqual({
                name: 'DESC', // default
                id: 'ASC',
            });
        });
    });
});
