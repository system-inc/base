// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { MetadataStorage } from '@system-inc/type-graphql/metadata/metadata-storage';
import type { GraphQLResolveInfo } from 'graphql';

import { getResolverInfo } from './GqlMiddleware';

class AccountQueryResolver {}
class SessionFieldResolver {}

// Metadata with a top-level `account` query AND an `account` field resolver
// on the Session type — a name collision.
const metadata = {
    queries: [
        {
            schemaName: 'account',
            target: AccountQueryResolver,
            methodName: 'account',
        },
    ],
    mutations: [],
    fieldResolvers: [
        {
            schemaName: 'account',
            target: SessionFieldResolver,
            methodName: 'account',
            getObjectType: () => ({ name: 'Session' }),
        },
    ],
    objectTypes: [{ target: { name: 'Session' }, name: 'Session' }],
} as unknown as MetadataStorage;

function infoFor(parentTypeName: string): GraphQLResolveInfo {
    return {
        fieldName: 'account',
        operation: { operation: 'query' },
        parentType: { name: parentTypeName },
        schema: {
            getQueryType: () => ({ name: 'Query' }),
            getMutationType: () => ({ name: 'Mutation' }),
        },
    } as unknown as GraphQLResolveInfo;
}

describe('getResolverInfo', () => {
    it('resolves a nested field to its field resolver, not a same-named top-level query', () => {
        const result = getResolverInfo(infoFor('Session'), metadata);
        expect(result.isFieldResolver).toBe(true);
        expect(result.resolverMetadata.target).toBe(SessionFieldResolver);
    });

    it('resolves a root-type field to the top-level query', () => {
        const result = getResolverInfo(infoFor('Query'), metadata);
        expect(result.isFieldResolver).toBe(false);
        expect(result.resolverMetadata.target).toBe(AccountQueryResolver);
    });

    it('resolves a field resolver declared on an implemented interface', () => {
        class NodeFieldResolver {}
        const interfaceMetadata = {
            queries: [],
            mutations: [],
            fieldResolvers: [
                {
                    schemaName: 'id',
                    target: NodeFieldResolver,
                    methodName: 'id',
                    getObjectType: () => ({ name: 'Node' }),
                },
            ],
            objectTypes: [{ target: { name: 'Node' }, name: 'Node' }],
        } as unknown as MetadataStorage;

        // queried on the concrete User type, which implements Node
        const info = {
            fieldName: 'id',
            operation: { operation: 'query' },
            parentType: {
                name: 'User',
                getInterfaces: () => [{ name: 'Node' }],
            },
            schema: {
                getQueryType: () => ({ name: 'Query' }),
                getMutationType: () => ({ name: 'Mutation' }),
            },
        } as unknown as GraphQLResolveInfo;

        const result = getResolverInfo(info, interfaceMetadata);
        expect(result.isFieldResolver).toBe(true);
        expect(result.resolverMetadata.target).toBe(NodeFieldResolver);
    });

    it('resolves a field resolver inherited from a base type', () => {
        class BaseEntity {}
        class UserEntity extends BaseEntity {}
        class BaseFieldResolver {}
        const inheritanceMetadata = {
            queries: [],
            mutations: [],
            fieldResolvers: [
                {
                    schemaName: 'createdAt',
                    target: BaseFieldResolver,
                    methodName: 'createdAt',
                    getObjectType: () => BaseEntity,
                },
            ],
            objectTypes: [
                { target: UserEntity, name: 'User' },
                { target: BaseEntity, name: 'BaseEntity' },
            ],
        } as unknown as MetadataStorage;

        // queried on the User subtype; the resolver sits on the base type
        const info = {
            fieldName: 'createdAt',
            operation: { operation: 'query' },
            parentType: { name: 'User' },
            schema: {
                getQueryType: () => ({ name: 'Query' }),
                getMutationType: () => ({ name: 'Mutation' }),
            },
        } as unknown as GraphQLResolveInfo;

        const result = getResolverInfo(info, inheritanceMetadata);
        expect(result.isFieldResolver).toBe(true);
        expect(result.resolverMetadata.target).toBe(BaseFieldResolver);
    });

    it('still throws when nothing matches', () => {
        const info = {
            fieldName: 'nope',
            operation: { operation: 'query' },
            parentType: { name: 'Whatever' },
            schema: {
                getQueryType: () => ({ name: 'Query' }),
                getMutationType: () => ({ name: 'Mutation' }),
            },
        } as unknown as GraphQLResolveInfo;
        expect(() => getResolverInfo(info, metadata)).toThrow(
            /Could not find resolver metadata/,
        );
    });
});
