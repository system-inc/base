// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { ArgumentValidationError } from '../error/ArgumentValidationError';
import { ColumnFilterInput } from '../graphql/ColumnFilter';
import {
    OrderByInput,
    orderByInputToFindOptionsOrder,
} from '../graphql/OrderByInput';
import { getPaginationInputMetadata } from '../graphql/PaginationInputMetadata';
import { OrmFindOptionsOrder } from './interfaces/find/OrmFindOptionsOrder';
import { OrmFindOptionsWhere } from './interfaces/find/OrmFindOptionsWhere';
import { columnFiltersToFindOperators } from './OrmColumnFilter';

/**
 * Pagination + filter input for the Orm find layer. NOT a GraphQL wire
 * type: resolvers receive the wire `PaginationInput` (or a
 * `@PaginationInputFor` subclass) and it is bridged here — automatically
 * by `ormPaginatedFind`, or explicitly via `OrmPaginationInput.from(...)`
 * when the resolver needs `scopeWhere`/narrowing before the find.
 */
export class OrmPaginationInput {
    /**
     * Creates an OrmPaginationInput from any pagination-shaped input —
     * typically the GraphQL wire `PaginationInput` a resolver received.
     *
     * When the input is an instance of a `@PaginationInputFor`-declared
     * class, its declared filter/order allowlists are applied
     * automatically — the declaration on the input type is the single
     * statement of what clients may filter and order by.
     */
    static from(pagination: {
        itemsPerPage: number;
        itemIndex?: number;
        filters?: ColumnFilterInput[];
        orderBy?: OrderByInput[];
    }): OrmPaginationInput {
        const input = new OrmPaginationInput();
        input.itemsPerPage = pagination.itemsPerPage;
        input.itemIndex = pagination.itemIndex;
        input.filters = pagination.filters;
        input.orderBy = pagination.orderBy;
        const declared = getPaginationInputMetadata(
            pagination.constructor as Constructor<object>,
        );
        if (declared) {
            input.declaredFilterColumns = declared.filterColumns;
            input.declaredOrderColumns = declared.orderColumns;
            input.allowedFilterColumns = declared.filterColumns;
            input.allowedOrderColumns = declared.orderColumns;
        }
        return input;
    }

    private scopeFindOptionsWhere?: OrmFindOptionsWhere<object> = undefined;

    private allowedFilterColumns?: ReadonlySet<string> = undefined;

    private allowedOrderColumns?: ReadonlySet<string> = undefined;

    /** The `@PaginationInputFor` declarations, kept to bound narrowing. */
    private declaredFilterColumns?: ReadonlySet<string> = undefined;

    private declaredOrderColumns?: ReadonlySet<string> = undefined;

    private findOptionsOrder?: OrmFindOptionsOrder<object> = undefined;

    itemsPerPage: number;

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

    /**
     * Opt in to client-supplied column filters for a fixed set of
     * columns.
     *
     * Fail closed: until a resolver calls this, any client `filters`
     * are REJECTED with an ArgumentValidationError — a query can never
     * be filter-injected on a column the server didn't explicitly
     * expose, and a filter the server won't honor is never silently
     * dropped (which would over-return rows the client asked to
     * exclude). Once an allowlist is set, a client filter naming a
     * column outside it throws rather than being silently applied or
     * silently dropped.
     *
     * This is the deliberate, narrow seam for exposing client-driven
     * filtering. Server-mandated conditions still go through
     * `scopeWhere` and always win over client filters.
     *
     * On an input declared with `@PaginationInputFor`, this may only
     * NARROW the declared set — the declaration is the outer bound of
     * what the type exposes, and widening past it here would silently
     * contradict the schema.
     */
    allowFilterColumns(columns: readonly string[]): this {
        this.assertNarrows(columns, this.declaredFilterColumns, 'filter');
        this.allowedFilterColumns = new Set(columns);
        return this;
    }

    /**
     * Opt in to client-supplied ordering for a fixed set of columns.
     * Same contract as `allowFilterColumns`: until set (directly or via
     * a `@PaginationInputFor` declaration), client `orderBy` is REJECTED
     * — an unvetted sort column is an unindexed-sort surface, so the
     * columns listed here are a statement that the query was planned for
     * them. On a declared input, this may only narrow the declared set.
     */
    allowOrderColumns(columns: readonly string[]): this {
        this.assertNarrows(columns, this.declaredOrderColumns, 'order');
        this.allowedOrderColumns = new Set(columns);
        return this;
    }

    private assertNarrows(
        columns: readonly string[],
        declared: ReadonlySet<string> | undefined,
        kind: 'filter' | 'order',
    ): void {
        if (!declared) {
            return;
        }
        const widened = columns.filter((column) => !declared.has(column));
        if (widened.length > 0) {
            throw new Error(
                `allow${kind === 'filter' ? 'Filter' : 'Order'}Columns may only narrow the ` +
                    `@PaginationInputFor declaration; not declared: ${widened.join(', ')}.`,
            );
        }
    }

    /**
     * Adds server-mandated scope conditions to the query.
     *
     * Scope conditions are AND'd with the client-supplied filters and
     * ALWAYS win on key collision — a client filter can never override
     * or drop a scope condition. Use this for every condition the
     * server requires (owner scoping, status gates, tenant boundaries).
     *
     * Multiple calls AND-merge; a later call wins over an earlier one
     * on the same key.
     */
    scopeWhere<Entity>(conditions: OrmFindOptionsWhere<Entity>) {
        this.scopeFindOptionsWhere = {
            ...this.scopeFindOptionsWhere,
            ...(conditions as OrmFindOptionsWhere<object>),
        };
    }

    addFindOptionsOrder<Entity>(findOptions: OrmFindOptionsOrder<Entity>) {
        if (!this.findOptionsOrder) {
            this.findOptionsOrder = findOptions;
            return;
        }
        this.findOptionsOrder = {
            ...this.findOptionsOrder,
            ...findOptions,
        };
    }

    getFindOptionsWhere(): OrmFindOptionsWhere<object> | undefined {
        const vettedFilters = this.getVettedClientFilters();
        const clientWhere = vettedFilters
            ? columnFiltersToFindOperators(vettedFilters)
            : undefined;
        if (!clientWhere && !this.scopeFindOptionsWhere) {
            return undefined;
        }
        // Scope spreads last: server-mandated conditions always win over
        // client-supplied filters on key collision.
        return {
            ...clientWhere,
            ...this.scopeFindOptionsWhere,
        };
    }

    /**
     * Returns the client filters that are permitted to drive the query,
     * or undefined when none were sent. Fail closed and loud: with no
     * allowlist set, any client filter throws (the operation does not
     * accept filters). With an allowlist, a filter on a column outside
     * it throws rather than applying or silently dropping.
     */
    private getVettedClientFilters(): ColumnFilterInput[] | undefined {
        if (!this.filters || this.filters.length === 0) {
            return undefined;
        }
        const allowed = this.allowedFilterColumns;
        if (!allowed) {
            throw new ArgumentValidationError({
                path: 'pagination.filters',
                constraints: {
                    isFilterable:
                        'This operation does not accept filters. ' +
                        '(Server code adding conditions should use scopeWhere, ' +
                        'which is never vetted and always wins.)',
                },
            });
        }
        const disallowed = [
            ...new Set(
                this.filters
                    .map((filter) => filter.column)
                    .filter((column) => !allowed.has(column)),
            ),
        ];
        if (disallowed.length > 0) {
            throw new ArgumentValidationError({
                path: 'pagination.filters',
                constraints: {
                    isAllowedColumn: `Filtering is not permitted on column(s): ${disallowed.join(', ')}.`,
                },
            });
        }
        return this.filters;
    }

    getFindOptionsOrder(): OrmFindOptionsOrder<object> | undefined {
        const orderBy = this.getVettedClientOrderBy();
        if (!orderBy) {
            return this.findOptionsOrder;
        }
        // For ORDER BY, key POSITION is the semantics — the adapter emits
        // terms in object-entry order. The vetted client sort leads (it
        // deliberately overrides the server's default order); server
        // defaults keep only keys the client didn't claim, appended after
        // as tiebreakers. Spreading the client keys last used to leave
        // the server default first, demoting the client's chosen sort to
        // an inert tiebreaker.
        const merged: OrmFindOptionsOrder<object> = {
            ...orderByInputToFindOptionsOrder(orderBy),
        };
        const mergedAsDictionary = merged as Record<string, unknown>;
        for (const [key, direction] of Object.entries(
            this.findOptionsOrder ?? {},
        )) {
            if (!(key in mergedAsDictionary)) {
                mergedAsDictionary[key] = direction;
            }
        }
        return merged;
    }

    /**
     * Returns the client orderBy entries permitted to drive the query, or
     * undefined when none were sent. Fail closed and loud, mirroring
     * `getVettedClientFilters`: with no order allowlist set, any client
     * orderBy throws (the operation does not accept ordering); with one,
     * a key outside it throws rather than sorting on an unplanned column.
     */
    private getVettedClientOrderBy(): OrderByInput[] | undefined {
        if (!this.orderBy || this.orderBy.length === 0) {
            return undefined;
        }
        const allowed = this.allowedOrderColumns;
        if (!allowed) {
            throw new ArgumentValidationError({
                path: 'pagination.orderBy',
                constraints: {
                    isOrderable:
                        'This operation does not accept ordering. ' +
                        '(Server code setting a default order should use ' +
                        'addFindOptionsOrder, which is never vetted.)',
                },
            });
        }
        const disallowed = [
            ...new Set(
                this.orderBy
                    .map((orderBy) => orderBy.key)
                    .filter((key) => !allowed.has(key)),
            ),
        ];
        if (disallowed.length > 0) {
            throw new ArgumentValidationError({
                path: 'pagination.orderBy',
                constraints: {
                    isAllowedColumn: `Ordering is not permitted on column(s): ${disallowed.join(', ')}.`,
                },
            });
        }
        return this.orderBy;
    }
}
