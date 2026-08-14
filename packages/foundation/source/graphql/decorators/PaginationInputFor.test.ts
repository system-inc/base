// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { buildSchema } from '@system-inc/type-graphql/utils/buildSchema';
import { printSchema } from 'graphql';

import { ColumnFilterConditionOperator } from '@system-inc/base-common/graphql/ColumnFilterConditionOperator';
import { OrderByDirection } from '@system-inc/base-common/graphql/OrderByDirection';
import { ArgumentValidationError } from '../../error/ArgumentValidationError';
import { OrmColumn } from '../../orm/decorators/OrmColumn';
import { OrmPrimaryAutoColumn } from '../../orm/decorators/OrmPrimaryAutoColumn';
import { OrmTable } from '../../orm/decorators/OrmTable';
import { OrmTrackingEntity } from '../../orm/entity/OrmTrackingEntity';
import { OrmPaginationInput } from '../../orm/OrmPaginationInput';
import { PaginationInput } from '../PaginationInput';
import { GqlArgument } from './GqlArgument';
import { GqlQuery } from './GqlQuery';
import { GqlResolver } from './GqlResolver';
import {
    PaginationInputFor,
    PaginationInputForOptions,
} from './PaginationInputFor';

@OrmTable('pif_ticket')
class PifTicket extends OrmTrackingEntity {
    @OrmPrimaryAutoColumn('uuid')
    declare id: string;

    @OrmColumn({ kind: 'varchar', length: 32 })
    declare status: string;

    @OrmColumn({ kind: 'varchar', length: 128 })
    declare userEmailAddress: string;

    @OrmColumn({ kind: 'datetime', mode: 'string' })
    declare createdAt: string;
}

@PaginationInputFor(PifTicket, {
    filterColumns: ['status', 'userEmailAddress'],
    orderColumns: ['createdAt', 'status'],
})
class PifTicketPaginationInput extends PaginationInput {}

@PaginationInputFor(PifTicket, {
    filterColumns: ['status'],
})
class PifTicketFilterOnlyPaginationInput extends PaginationInput {}

@GqlResolver()
class PifResolver {
    @GqlQuery(() => String)
    pifTickets(
        @GqlArgument('pagination', () => PifTicketPaginationInput)
        _pagination: PifTicketPaginationInput,
    ): string {
        return 'ok';
    }

    @GqlQuery(() => String)
    pifTicketsFilterOnly(
        @GqlArgument('pagination', () => PifTicketFilterOnlyPaginationInput)
        _pagination: PifTicketFilterOnlyPaginationInput,
    ): string {
        return 'ok';
    }
}

function paginationFrom(
    inputClass: new () => PaginationInput,
    data: Partial<PaginationInput>,
): OrmPaginationInput {
    const wire = new inputClass();
    wire.itemsPerPage = data.itemsPerPage ?? 10;
    wire.filters = data.filters;
    wire.orderBy = data.orderBy;
    return OrmPaginationInput.from(wire);
}

describe('@PaginationInputFor', () => {
    describe('schema generation', () => {
        let sdl: string;

        beforeAll(async () => {
            const schema = await buildSchema({
                resolvers: [PifResolver],
                emitSchemaFile: false,
                authMode: 'error',
            });
            sdl = printSchema(schema);
        });

        it('registers the subclass as a named input inheriting pagination fields', () => {
            expect(sdl).toContain('input PifTicketPaginationInput');
            expect(sdl).toMatch(
                /input PifTicketPaginationInput[\s\S]*?itemsPerPage: Int!/,
            );
        });

        it('bare PaginationInput exposes no filters/orderBy fields', () => {
            const bare = sdl.match(/input PaginationInput \{[\s\S]*?\}/);
            // The bare type only appears in the SDL if some operation uses
            // it; in this fixture none does, so absence is also a pass.
            if (bare) {
                expect(bare[0]).not.toContain('filters');
                expect(bare[0]).not.toContain('orderBy');
            }
        });

        it('types filters and orderBy with generated enum-typed inputs', () => {
            expect(sdl).toMatch(
                /input PifTicketPaginationInput[\s\S]*?filters: \[PifTicketFilterInput!\]/,
            );
            expect(sdl).toMatch(
                /input PifTicketPaginationInput[\s\S]*?orderBy: \[PifTicketOrderByInput!\]/,
            );
            expect(sdl).toMatch(
                /enum PifTicketFilterColumn \{\s*status\s*userEmailAddress\s*\}/,
            );
            expect(sdl).toMatch(
                /input PifTicketFilterInput[\s\S]*?column: PifTicketFilterColumn!/,
            );
            expect(sdl).toMatch(
                /input PifTicketOrderByInput[\s\S]*?key: PifTicketOrderColumn!/,
            );
            // Inherited fields survive on the generated inputs.
            expect(sdl).toMatch(
                /input PifTicketFilterInput[\s\S]*?operator: ColumnFilterConditionOperator!/,
            );
            expect(sdl).toMatch(
                /input PifTicketOrderByInput[\s\S]*?direction: OrderByDirection/,
            );
        });

        it('documents the declared columns in the type description', () => {
            expect(sdl).toContain(
                'Filterable columns: status, userEmailAddress.',
            );
            expect(sdl).toContain('Orderable columns: createdAt, status.');
        });

        it('an undeclared capability has NO field at all — not expressible', () => {
            const filterOnly = sdl.match(
                /input PifTicketFilterOnlyPaginationInput \{[\s\S]*?\}/,
            )![0];
            expect(filterOnly).toContain('filters');
            expect(filterOnly).not.toContain('orderBy');
            expect(sdl).toContain('This operation does not accept ordering.');
        });
    });

    describe('virtual order columns', () => {
        it('joins the enum and allowlist without entity validation', async () => {
            @PaginationInputFor(PifTicket, {
                orderColumns: ['createdAt'],
                virtualOrderColumns: ['sortOrder'],
            })
            class PifVirtualPaginationInput extends PaginationInput {}

            @GqlResolver()
            class PifVirtualResolver {
                @GqlQuery(() => String)
                pifVirtual(
                    @GqlArgument('pagination', () => PifVirtualPaginationInput)
                    _pagination: PifVirtualPaginationInput,
                ): string {
                    return 'ok';
                }
            }
            const schema = await buildSchema({
                resolvers: [PifVirtualResolver],
                emitSchemaFile: false,
                authMode: 'error',
            });
            const virtualSdl = printSchema(schema);
            expect(virtualSdl).toMatch(
                /enum PifVirtualOrderColumn \{\s*createdAt\s*sortOrder\s*\}/,
            );

            // Runtime allowlist covers the virtual key too.
            const pagination = paginationFrom(PifVirtualPaginationInput, {
                orderBy: [
                    { key: 'sortOrder', direction: OrderByDirection.Ascending },
                ],
            });
            expect(pagination.getFindOptionsOrder()).toEqual({
                sortOrder: 'ASC',
            });
        });

        it('rejects a virtual key that is actually an entity column', () => {
            expect(() => {
                @PaginationInputFor(PifTicket, {
                    virtualOrderColumns: ['createdAt'],
                })
                class _Bad extends PaginationInput {}
            }).toThrow(/IS a column of 'PifTicket'/);
        });
    });

    describe('definition-time validation', () => {
        // The `as never` casts bypass the compile-time key typing on
        // purpose: these tests exercise the runtime metadata gate, which
        // still backs the types (a non-column class property, metadata
        // drift, or a plain-JS caller).
        it('throws at class definition for a column that does not exist', () => {
            expect(() => {
                @PaginationInputFor(PifTicket, {
                    filterColumns: ['nope' as never],
                })
                class _Bad extends PaginationInput {}
            }).toThrow(/'nope' is not a column of 'PifTicket'/);
        });

        it('throws for an entity that is not a registered @OrmTable', () => {
            class NotAnEntity {}
            expect(() => {
                @PaginationInputFor(NotAnEntity, {
                    filterColumns: ['x' as never],
                })
                class _Bad extends PaginationInput {}
            }).toThrow(/not a registered @OrmTable/);
        });

        it('rejects an invalid column name at compile time', () => {
            const options: PaginationInputForOptions<PifTicket> = {
                // @ts-expect-error -- 'nope' is not a property of PifTicket
                filterColumns: ['nope'],
                orderColumns: ['createdAt'],
            };
            expect(options.orderColumns).toEqual(['createdAt']);
        });

        it('a second declaration reducing to the same prefix throws naming both', () => {
            // The class name is a public contract: the generated GraphQL
            // type names derive from it, so a duplicate prefix would fail
            // schema build with an error naming neither declaration.
            @PaginationInputFor(PifTicket, {
                filterColumns: ['status'],
            })
            class PifCollisionPaginationInput extends PaginationInput {}
            void PifCollisionPaginationInput;

            expect(() => {
                @PaginationInputFor(PifTicket, {
                    filterColumns: ['status'],
                })
                class PifCollisionInput extends PaginationInput {}
                void PifCollisionInput;
            }).toThrow(
                /'PifCollision' is already claimed by PifCollisionPaginationInput/,
            );
        });

        it('a declaration that throws does not claim its prefix', () => {
            // The two _Bad classes above prove this transitively (the
            // second would otherwise report a phantom collision with the
            // first), but pin it directly: a failed declaration must leave
            // the name free for a valid one.
            expect(() => {
                @PaginationInputFor(PifTicket, {
                    filterColumns: ['nope' as never],
                })
                class PifReclaimedPaginationInput extends PaginationInput {}
                void PifReclaimedPaginationInput;
            }).toThrow(/'nope' is not a column/);

            @PaginationInputFor(PifTicket, {
                filterColumns: ['status'],
            })
            class PifReclaimedPaginationInput extends PaginationInput {}
            void PifReclaimedPaginationInput;
        });
    });

    describe('runtime vetting via OrmPaginationInput.from', () => {
        it('applies the declared filter allowlist automatically', () => {
            const pagination = paginationFrom(PifTicketPaginationInput, {
                filters: [
                    {
                        column: 'status',
                        operator: ColumnFilterConditionOperator.Equal,
                        value: 'Open',
                    },
                ],
            });
            expect(pagination.getFindOptionsWhere()).toEqual({
                status: 'Open',
            });
        });

        it('applies the declared order allowlist automatically', () => {
            const pagination = paginationFrom(PifTicketPaginationInput, {
                orderBy: [
                    { key: 'createdAt', direction: OrderByDirection.Ascending },
                ],
            });
            expect(pagination.getFindOptionsOrder()).toEqual({
                createdAt: 'ASC',
            });
        });

        it('rejects ordering on an input that only declared filters', () => {
            const pagination = paginationFrom(
                PifTicketFilterOnlyPaginationInput,
                {
                    orderBy: [
                        {
                            key: 'createdAt',
                            direction: OrderByDirection.Ascending,
                        },
                    ],
                },
            );
            expect(() => pagination.getFindOptionsOrder()).toThrow(
                ArgumentValidationError,
            );
        });

        it('allowFilterColumns may narrow but not widen the declaration', () => {
            const pagination = paginationFrom(PifTicketPaginationInput, {
                filters: [
                    {
                        column: 'userEmailAddress',
                        operator: ColumnFilterConditionOperator.Equal,
                        value: 'a@b.c',
                    },
                ],
            });
            expect(() =>
                pagination.allowFilterColumns(['status', 'createdAt']),
            ).toThrow(/may only narrow/);

            pagination.allowFilterColumns(['status']);
            let thrown: unknown;
            try {
                pagination.getFindOptionsWhere();
            } catch (error) {
                thrown = error;
            }
            expect(thrown).toBeInstanceOf(ArgumentValidationError);
            expect(
                JSON.stringify((thrown as ArgumentValidationError).extensions),
            ).toContain('userEmailAddress');
        });
    });
});
