// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { OrmEntityKey } from '../../orm/interfaces/OrmPartialEntity';
import { ormGetTable } from '../../orm/metadata/OrmSchemaRegistry';
import { ColumnFilterInput } from '../ColumnFilter';
import { OrderByInput } from '../OrderByInput';
import { PaginationInput } from '../PaginationInput';
import {
    claimPaginationInputBaseName,
    getPaginationInputBaseNameOwner,
    recordPaginationInputMetadata,
} from '../PaginationInputMetadata';
import { gqlRegisterEnumType } from '../types/GqlRegisterEnumType';
import { GqlField } from './GqlField';
import { GqlInputType } from './GqlInputType';

/**
 * Declaration options for {@link PaginationInputFor}. Column names are the
 * entity's property keys, typed as `OrmEntityKey<Entity>` (the same
 * non-function-key idiom the ORM's find options use) so an invalid name is
 * a compile error at the declaration site. An omitted list means that
 * capability is not offered: client filters (or orderBy) sent anyway are
 * rejected, exactly as on a bare `PaginationInput`.
 */
export interface PaginationInputForOptions<Entity = object> {
    filterColumns?: readonly OrmEntityKey<Entity>[];
    orderColumns?: readonly OrmEntityKey<Entity>[];
    /**
     * Order keys the operation accepts that are NOT columns of `entity` —
     * query-level sort keys the resolver translates itself (e.g. a
     * junction-table column in a hand-written join). They join the
     * generated order enum and the runtime allowlist like any other key,
     * but are excluded from entity-column validation and from `base
     * check`'s index cross-reference: by declaring one, the resolver
     * takes ownership of translating it safely and planning its index.
     */
    virtualOrderColumns?: readonly string[];
}

/**
 * Declares a pagination input type for one operation (or a family of
 * operations sharing the same exposure): which of `entity`'s columns a
 * client may filter and order by.
 *
 * Apply to a subclass of `PaginationInput`. The decorator registers the
 * subclass as a named GraphQL input type and synthesizes enum-typed
 * `filters`/`orderBy` fields from the declared columns, so the allowlist
 * is part of the schema — an invalid column fails GraphQL validation
 * before resolver code runs — and flows into frontend codegen. The ORM
 * bridge (`OrmPaginationInput.from`) reads the same declaration to
 * enforce the allowlists at runtime, so vetting cannot be forgotten at a
 * call site.
 *
 * A bare `PaginationInput` argument remains the right choice for plain
 * pagination: it accepts page inputs only and rejects client filters and
 * ordering. This decorator is the single opt-in to client-driven
 * filtering/ordering, and the declaration is deliberately explicit — the
 * columns listed here are a statement that the operation's queries were
 * planned for them (see the `base check` index cross-reference).
 *
 * Column names are typed as keys of `entity` (a typo is a compile error at
 * the declaration site) and validated against the entity's ORM metadata at
 * class definition time — the runtime gate still matters because a class
 * property need not be a column (and metadata can drift from types), so a
 * non-column property throws at import, not at first request.
 */
export function PaginationInputFor<Entity extends object>(
    entity: Constructor<Entity>,
    options: PaginationInputForOptions<Entity>,
) {
    return function (target: Constructor<PaginationInput>): void {
        const table = ormGetTable(entity);
        if (!table) {
            throw new Error(
                `@PaginationInputFor on ${target.name}: '${entity.name}' is not a registered @OrmTable entity.`,
            );
        }
        const columnKeys = new Set(
            table.columns.map((column) => column.propertyKey),
        );
        const validateColumns = (
            columns: readonly string[],
            kind: 'filterColumns' | 'orderColumns',
        ) => {
            for (const column of columns) {
                if (!columnKeys.has(column)) {
                    throw new Error(
                        `@PaginationInputFor on ${target.name}: ${kind} entry '${column}' is not a column of '${entity.name}'.`,
                    );
                }
            }
        };

        // The prefix for every generated enum and input type, taken from the
        // class name: 'SupportTicketsPaginationInput' → 'SupportTickets'.
        //
        // So this class name IS a public contract, not a local identifier —
        // renaming it renames GraphQL types that clients bind to. Name the
        // class for the query it configures (always plural: `supportTickets`,
        // `postReports`), which is what keeps the generated
        // '<PluralQuery>FilterInput' from ever colliding with a hand-written
        // '<Entity>FilterInput'.
        const baseName =
            target.name.replace(/(PaginationInput|Input)$/, '') || target.name;

        // Two declarations sharing a prefix generate two GraphQL types with
        // one name, and graphql rejects the finished schema hundreds of
        // frames from here — `Schema must contain uniquely named types`,
        // naming neither site. Claim the prefix at the declaration instead,
        // so the failure arrives at import with both files in the message.
        //
        // Checked here but claimed at the end, once the declaration is known
        // to be good. A class that throws for an invalid column never existed
        // as far as the schema is concerned, so it must not leave its prefix
        // claimed behind it — that would report the next declaration as a
        // collision with a class that failed to define.
        const owner = getPaginationInputBaseNameOwner(baseName);
        if (owner && owner !== target) {
            throw new Error(
                `@PaginationInputFor on ${target.name}: the generated name prefix '${baseName}' is already claimed by ${owner.name}. ` +
                    `Both would generate '${baseName}FilterInput' and '${baseName}OrderByInput'. ` +
                    `Rename one of them for the query it configures — a list query is plural, so its input is too.`,
            );
        }

        const descriptionParts: string[] = [];

        if (options.filterColumns && options.filterColumns.length > 0) {
            validateColumns(options.filterColumns, 'filterColumns');
            const filterColumnEnum: Record<string, string> = {};
            for (const column of options.filterColumns) {
                filterColumnEnum[column] = column;
            }
            gqlRegisterEnumType(filterColumnEnum, {
                name: `${baseName}FilterColumn`,
                description: `Columns ${target.name} permits filtering on.`,
            });

            // A ColumnFilterInput whose `column` is the generated enum;
            // operator/value are inherited unchanged.
            const filterInput = class extends ColumnFilterInput {};
            Object.defineProperty(filterInput, 'name', {
                value: `${baseName}FilterInput`,
            });
            GqlField(() => filterColumnEnum)(filterInput.prototype, 'column');
            GqlInputType(`${baseName}FilterInput`)(filterInput);

            GqlField(() => [filterInput], { nullable: true })(
                target.prototype,
                'filters',
            );
            descriptionParts.push(
                `Filterable columns: ${options.filterColumns.join(', ')}.`,
            );
        } else {
            descriptionParts.push('This operation does not accept filters.');
        }

        // Entity order columns are validated against the entity; virtual
        // keys are the resolver's own (translated in its query) and join
        // the enum + allowlist unvalidated. A virtual key must not shadow
        // a real column — that would be a plain orderColumns entry.
        const virtualOrderColumns = options.virtualOrderColumns ?? [];
        for (const virtualKey of virtualOrderColumns) {
            if (columnKeys.has(virtualKey)) {
                throw new Error(
                    `@PaginationInputFor on ${target.name}: virtualOrderColumns entry '${virtualKey}' IS a column of '${entity.name}' — declare it in orderColumns.`,
                );
            }
        }
        const allOrderColumns = [
            ...(options.orderColumns ?? []),
            ...virtualOrderColumns,
        ];
        if (allOrderColumns.length > 0) {
            if (options.orderColumns) {
                validateColumns(options.orderColumns, 'orderColumns');
            }
            const orderColumnEnum: Record<string, string> = {};
            for (const column of allOrderColumns) {
                orderColumnEnum[column] = column;
            }
            gqlRegisterEnumType(orderColumnEnum, {
                name: `${baseName}OrderColumn`,
                description: `Columns ${target.name} permits ordering by.`,
            });

            // An OrderByInput whose `key` is the generated enum; direction
            // is inherited unchanged.
            const orderByInput = class extends OrderByInput {};
            Object.defineProperty(orderByInput, 'name', {
                value: `${baseName}OrderByInput`,
            });
            GqlField(() => orderColumnEnum)(orderByInput.prototype, 'key');
            GqlInputType(`${baseName}OrderByInput`)(orderByInput);

            GqlField(() => [orderByInput], { nullable: true })(
                target.prototype,
                'orderBy',
            );
            descriptionParts.push(
                `Orderable columns: ${allOrderColumns.join(', ')}.`,
            );
        } else {
            descriptionParts.push('This operation does not accept ordering.');
        }

        GqlInputType(target.name, {
            description: descriptionParts.join(' '),
        })(target);

        recordPaginationInputMetadata(target, {
            entity,
            filterColumns: options.filterColumns
                ? new Set(options.filterColumns)
                : undefined,
            orderColumns:
                allOrderColumns.length > 0
                    ? new Set(allOrderColumns)
                    : undefined,
            virtualOrderColumns:
                virtualOrderColumns.length > 0
                    ? new Set(virtualOrderColumns)
                    : undefined,
        });

        // Claimed last, so only a declaration that fully succeeded owns its
        // generated names. See the check above.
        claimPaginationInputBaseName(baseName, target);
    };
}
