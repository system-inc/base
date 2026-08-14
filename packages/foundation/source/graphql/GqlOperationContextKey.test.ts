// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { GraphQLResolveInfo } from 'graphql';

import { gqlOperationContextKey } from './GqlOperationContext';

// Build a fake info carrying only the response `path` the key derives from.
function infoWithPath(...keys: (string | number)[]): GraphQLResolveInfo {
    let path: unknown = undefined;
    for (const key of keys) {
        path = { key, prev: path, typename: undefined };
    }
    return { path } as GraphQLResolveInfo;
}

describe('gqlOperationContextKey', () => {
    it('derives a namespaced key from the response path', () => {
        expect(gqlOperationContextKey(infoWithPath('user'))).toBe(
            'gqlOperationContext:user',
        );
        expect(
            gqlOperationContextKey(infoWithPath('user', 'posts', 'title')),
        ).toBe('gqlOperationContext:user.posts.title');
    });

    it('gives aliased duplicates of the same field distinct keys', () => {
        // `a: user{...}` and `b: user{...}` resolve the same method but sit at
        // different response paths — they must not share a context slot.
        const a = gqlOperationContextKey(infoWithPath('a'));
        const b = gqlOperationContextKey(infoWithPath('b'));
        expect(a).not.toBe(b);
    });

    it('namespaces so a field aliased like a context property cannot clobber it', () => {
        // a top-level field named/aliased `operations` must not collide with
        // GqlContext.operations
        expect(gqlOperationContextKey(infoWithPath('operations'))).toBe(
            'gqlOperationContext:operations',
        );
        expect(gqlOperationContextKey(infoWithPath('operations'))).not.toBe(
            'operations',
        );
    });
});
