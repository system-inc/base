// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { GraphQLResolveInfo } from 'graphql';

import { parseSelectionSet } from './GqlMiddleware';

// Minimal GraphQL AST builders (only the fields parseSelectionSet reads).
function field(name: string, selections?: unknown[]): unknown {
    return {
        kind: 'Field',
        name: { kind: 'Name', value: name },
        selectionSet: selections
            ? { kind: 'SelectionSet', selections: selections }
            : undefined,
    };
}

function fragmentSpread(name: string): unknown {
    return { kind: 'FragmentSpread', name: { kind: 'Name', value: name } };
}

function inlineFragment(selections: unknown[]): unknown {
    return {
        kind: 'InlineFragment',
        selectionSet: { kind: 'SelectionSet', selections: selections },
    };
}

function infoFor(
    rootSelections: unknown[],
    fragments: Record<string, unknown[]> = {},
): GraphQLResolveInfo {
    const fragmentDefs: Record<string, unknown> = {};
    for (const [name, selections] of Object.entries(fragments)) {
        fragmentDefs[name] = {
            kind: 'FragmentDefinition',
            name: { kind: 'Name', value: name },
            selectionSet: { kind: 'SelectionSet', selections: selections },
        };
    }
    return {
        fieldNodes: [
            {
                kind: 'Field',
                name: { kind: 'Name', value: 'root' },
                selectionSet: {
                    kind: 'SelectionSet',
                    selections: rootSelections,
                },
            },
        ],
        fragments: fragmentDefs,
    } as unknown as GraphQLResolveInfo;
}

describe('parseSelectionSet', () => {
    it('collects plain field selections', () => {
        const info = infoFor([field('id'), field('name')]);
        expect(parseSelectionSet(info)).toEqual({ id: true, name: true });
    });

    it('resolves a named fragment spread into its fields', () => {
        // query { root { ...OrderFields } }
        // fragment OrderFields on Order { id items { id } }
        const info = infoFor([fragmentSpread('OrderFields')], {
            OrderFields: [field('id'), field('items', [field('id')])],
        });
        expect(parseSelectionSet(info)).toEqual({
            id: true,
            items: { id: true },
        });
    });

    it('resolves a fragment spread nested inside an inline fragment', () => {
        // { ... on Order { ...OrderFields } }
        const info = infoFor(
            [inlineFragment([fragmentSpread('OrderFields')])],
            { OrderFields: [field('id')] },
        );
        expect(parseSelectionSet(info)).toEqual({ id: true });
    });

    it('merges inline-fragment fields with sibling plain fields', () => {
        const info = infoFor([field('id'), inlineFragment([field('status')])]);
        expect(parseSelectionSet(info)).toEqual({ id: true, status: true });
    });
});
