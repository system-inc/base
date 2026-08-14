// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { responsePathAsArray, type GraphQLResolveInfo } from 'graphql';

/**
 * The context-bag key a resolver's {@link GqlOperationContext} is stored
 * under, derived from the field's **response path** so it is unique per
 * field invocation.
 *
 * Keying by the resolver method (`Class.method`) would collide when a
 * document aliases the same field twice — `a: user{name} b: user{email}` —
 * making both invocations read the last one's selection set. The response
 * path (`a`, `b`, `parent.child`, …) is unique per field. Namespaced so a
 * field aliased `operations`/`request` can't clobber a real GqlContext
 * property.
 */
export function gqlOperationContextKey(info: GraphQLResolveInfo): string {
    return `gqlOperationContext:${responsePathAsArray(info.path).join('.')}`;
}

/**
 * Context for a GraphQL operation, including the operation type, name, and selection set.
 */
export class GqlOperationContext<K> {
    /**
     * The operation type.
     */
    readonly type: 'query' | 'mutation';

    /**
     * The operation name.
     */
    readonly name: string;

    /**
     * The selection set.
     */
    readonly selectionSet: Readonly<GqlSelectionSet<K>>;

    constructor(
        type: 'query' | 'mutation',
        name: string,
        selectionSet: GqlSelectionSet<K>,
    ) {
        this.type = type;
        this.name = name;
        this.selectionSet = selectionSet;
    }
}

/**
 * A selection set for a GraphQL operation.
 */
export type GqlSelectionSet<T> = Partial<ExtractSelection<Required<T>>>;

/**
 * Utility type for extracting properties from a type as a SelectionSet.
 *
 * Null is stripped before every branch. A nullable object field is still an
 * object a client selects subfields from, so it recurses like any other rather
 * than collapsing to `true` and handing a resolver a boolean where the nested
 * selection belongs.
 */
type ExtractSelection<T> = {
    [K in keyof T]: Exclude<T[K], null | undefined> extends Array<infer U>
        ? GqlSelectionSet<U> // Recurse on the array's element type
        : Exclude<T[K], null | undefined> extends object
          ? GqlSelectionSet<Exclude<T[K], null | undefined>>
          : true;
};
