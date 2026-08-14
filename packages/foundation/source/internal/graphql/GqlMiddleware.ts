// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import type {
    FieldResolverMetadata,
    ResolverMetadata,
} from '@system-inc/type-graphql/metadata/definitions/resolver-metadata';
import { getMetadataStorage } from '@system-inc/type-graphql/metadata/getMetadataStorage';
import type { MetadataStorage } from '@system-inc/type-graphql/metadata/metadata-storage';
import type {
    NextFn,
    MiddlewareInterface as TypeGraphQLMiddleware,
} from '@system-inc/type-graphql/typings/middleware';
import type { ResolverData } from '@system-inc/type-graphql/typings/resolver-data';
import type { FieldNode, GraphQLResolveInfo, SelectionNode } from 'graphql';

import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { BaseHandler } from '@system-inc/base-common/type/BaseHandler';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import {
    GenericTrap,
    Mutable,
} from '@system-inc/base-common/type/UtilityTypes';
import { getBaseMetadata } from '../../base/BaseMetadata';
import { Injectable } from '../../dependency-injection/decorators/Injectable';
import { BaseError } from '../../error/BaseError';
import {
    UnhandledExceptionEvent,
    UnhandledExceptionEventName,
} from '../../event/UnhandledExceptionEvent';
import {
    GqlOperationContext,
    gqlOperationContextKey,
    GqlSelectionSet,
} from '../../graphql/GqlOperationContext';
import { runHandlerMiddleware } from '../middleware/Middleware';
import { RequestTimings } from '../request/RequestTimings';
import { GqlContext } from './GqlContext';

@Injectable()
export class GqlMiddleware implements TypeGraphQLMiddleware<GqlContext> {
    async use({ context, info }: ResolverData<GqlContext>, next: NextFn) {
        const typeGraphQLMetadata = getMetadataStorage();

        // set the graphql context on the request context if we need to
        // this gets called for every resolver, but we only need to set it once per request,
        // so we check if it is already set before setting it
        if (!context.request.context.graphql) {
            context.request.context.graphql = context;
        }

        // get the method and class name for the operation
        const resolverInfo = getResolverInfo(info, typeGraphQLMetadata);
        // create a handler identity to pass to the middleware functions and
        // record on the request context so deferred actions and method-level
        // metadata lookups can find it.
        const handler = new BaseHandler(
            resolverInfo.resolverMetadata.target as Constructor<object>,
            resolverInfo.resolverMetadata.methodName,
        );
        // Set the shared slot for user middleware / deferred actions that
        // read it, but pass `handler` explicitly to runHandlerMiddleware
        // below — concurrent sibling fields share this RequestContext, so the
        // security-critical enforcement must not read this racy slot.
        context.request.context.handler = handler;
        // check if we need to provide additional operation context for this operation
        const provideOperationContext =
            getBaseMetadata().graphql.requestedGqlOperationContext(handler);
        if (provideOperationContext) {
            const mutableContext = context as GenericTrap<GqlContext>;
            // Key by the field's response path, not the resolver method, so
            // aliased duplicates of the same field don't overwrite each
            // other's operation context (@InjectGqlOperationContext reads the
            // same path-based key).
            mutableContext[gqlOperationContextKey(info)] =
                new GqlOperationContext(
                    info.operation.operation === 'mutation'
                        ? 'mutation'
                        : 'query',
                    info.fieldName,
                    parseSelectionSet(info),
                );
        }

        if (!resolverInfo.isFieldResolver) {
            if (!context.operations) {
                const mutableContext = context as Mutable<GqlContext>;
                mutableContext.operations = [info.fieldName];
            } else {
                const mutableOperations = context.operations as string[];
                mutableOperations.push(info.fieldName);
            }
            Logger.debug(
                LogCategory.Gql,
                'GraphQL Operation: %s',
                info.fieldName,
            );
        }

        // run handler middleware (e.g., rate limiter, session access) now
        // that the handler is known.
        const middlewareResult = await runHandlerMiddleware(
            context.request.context,
            handler,
        );

        if (!resolverInfo.isFieldResolver) {
            context.request.context.stopWatch.split(RequestTimings.Middleware);
        }
        if (middlewareResult) {
            // In the GraphQL path, middleware shouldn't return a Response —
            // it should throw instead. If one does return a Response here,
            // surface it as an error so type-graphql handles it consistently.
            throw new Error(
                'Handler middleware returned a Response in a GraphQL context. ' +
                    'Throw an error instead of returning a Response.',
            );
        }

        let result: unknown;
        try {
            result = await next();
        } catch (e) {
            // An error the app didn't model escaped the resolver — surface
            // it to unhandled-exception listeners after the response goes
            // out, then rethrow unchanged so type-graphql/yoga masking
            // (gqlMaskError) behaves exactly as before. Intentional
            // client-facing errors (HttpError, validation) are not fired.
            if (BaseError.forClient(e).masked) {
                context.request.context.eventBus.defer<UnhandledExceptionEvent>(
                    {
                        name: UnhandledExceptionEventName,
                        error: e,
                        surface: 'graphql',
                        requestId: context.request.context.requestId,
                        ipAddress: context.request.context.ipAddress,
                        userAgent: context.request.context.userAgent,
                        detail: info.fieldName,
                    },
                );
            }
            throw e;
        }
        if (!resolverInfo.isFieldResolver) {
            context.request.context.stopWatch.split(RequestTimings.Handler);
        }
        return result;
    }
}

export function getResolverInfo(
    info: GraphQLResolveInfo,
    typeGraphQLMetadata: MetadataStorage,
): {
    readonly resolverMetadata: ResolverMetadata | FieldResolverMetadata;
    readonly isFieldResolver: boolean;
} {
    let isFieldResolver = false;
    let resolverMetadata: ResolverMetadata | FieldResolverMetadata | undefined;

    // Match top-level queries/mutations only when the field actually sits on
    // the root Query/Mutation type. A @GqlFieldResolver on a nested type can
    // share a field name with a top-level operation (user/account/session
    // are routine), and matching by name alone would attribute the field
    // resolver to the same-named operation — enforcing the wrong handler's
    // access control (a bypass, or a spurious 401/403).
    const isRootField =
        info.parentType.name === info.schema.getQueryType()?.name ||
        info.parentType.name === info.schema.getMutationType()?.name;
    if (isRootField && info.operation.operation === 'query') {
        resolverMetadata = typeGraphQLMetadata.queries.find(
            (query) => query.schemaName === info.fieldName,
        );
    } else if (isRootField && info.operation.operation === 'mutation') {
        resolverMetadata = typeGraphQLMetadata.mutations.find(
            (mutation) => mutation.schemaName === info.fieldName,
        );
    }

    // if we didn't find a query or mutation, check to see if it is a field resolver
    if (!resolverMetadata) {
        const objectTypeForResolver = (
            fieldResolver: FieldResolverMetadata,
        ) => {
            const declaredClass = fieldResolver.getObjectType?.();
            if (!declaredClass) return undefined;
            return typeGraphQLMetadata.objectTypes.find(
                (objectType) => objectType.target.name === declaredClass.name,
            );
        };

        // Phase 1: a field resolver declared directly on the parent type.
        resolverMetadata = typeGraphQLMetadata.fieldResolvers.find(
            (fieldResolver) =>
                fieldResolver.schemaName === info.fieldName &&
                objectTypeForResolver(fieldResolver)?.name ===
                    info.parentType.name,
        );

        // Phase 2: a field resolver declared on an interface the concrete
        // parent type implements, or inherited from a base class the parent's
        // class extends. type-graphql resolves such fields at runtime, so
        // getResolverInfo must recognize them too — otherwise every such query
        // throws below. The resolver's own class still carries its
        // access-control decorators, so attribution stays correct.
        if (!resolverMetadata) {
            const getInterfaces = (
                info.parentType as {
                    getInterfaces?: () => ReadonlyArray<{ name: string }>;
                }
            ).getInterfaces;
            const parentInterfaceNames = new Set(
                typeof getInterfaces === 'function'
                    ? getInterfaces
                          .call(info.parentType)
                          .map((iface) => iface.name)
                    : [],
            );
            const parentObjectType = typeGraphQLMetadata.objectTypes.find(
                (objectType) => objectType.name === info.parentType.name,
            );

            resolverMetadata = typeGraphQLMetadata.fieldResolvers.find(
                (fieldResolver) => {
                    if (fieldResolver.schemaName !== info.fieldName) {
                        return false;
                    }
                    const declaredType = objectTypeForResolver(fieldResolver);
                    if (!declaredType) return false;
                    // declared on an interface the parent type implements
                    if (parentInterfaceNames.has(declaredType.name)) {
                        return true;
                    }
                    // inherited from a base class the parent's class extends
                    return (
                        !!parentObjectType &&
                        classExtends(
                            parentObjectType.target,
                            declaredType.target,
                        )
                    );
                },
            );
        }

        isFieldResolver = !!resolverMetadata;
    }

    if (!resolverMetadata) {
        throw new Error(
            `Could not find resolver metadata for operation: ${info.fieldName}`,
        );
    }

    return {
        resolverMetadata,
        isFieldResolver,
    };
}

/**
 * Whether `descendant` is, or transitively extends, `ancestor` — walking the
 * class prototype chain. Used to attribute a field resolver declared on a base
 * class to a query on one of its subtypes.
 */
function classExtends(descendant: object, ancestor: object): boolean {
    let current: object | null = descendant;
    while (current && current !== Function.prototype) {
        if (current === ancestor) return true;
        current = Object.getPrototypeOf(current);
    }
    return false;
}

export function parseSelectionSet(
    info: GraphQLResolveInfo,
    fieldNodes: readonly FieldNode[] = info.fieldNodes,
): GqlSelectionSet<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const selections: GqlSelectionSet<any> = {};

    for (const fieldNode of fieldNodes) {
        if (fieldNode.selectionSet) {
            collectSelections(
                info,
                fieldNode.selectionSet.selections,
                selections,
            );
        }
    }

    return selections;
}

/**
 * Populate `target` from a selection set, flattening inline fragments and
 * named fragment spreads into the fields they contribute. Named fragments
 * (the default output of GraphQL codegen tooling) are resolved via
 * `info.fragments`; skipping them would silently drop every field a client
 * selected through a fragment.
 */
function collectSelections(
    info: GraphQLResolveInfo,
    selectionNodes: readonly SelectionNode[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    target: GqlSelectionSet<any>,
): void {
    for (const selection of selectionNodes) {
        if (selection.kind === 'Field') {
            target[selection.name.value] = selection.selectionSet
                ? parseSelectionSet(info, [selection])
                : true;
        } else if (selection.kind === 'InlineFragment') {
            if (selection.selectionSet) {
                collectSelections(
                    info,
                    selection.selectionSet.selections,
                    target,
                );
            }
        } else if (selection.kind === 'FragmentSpread') {
            const fragment = info.fragments[selection.name.value];
            if (fragment) {
                collectSelections(
                    info,
                    fragment.selectionSet.selections,
                    target,
                );
            }
        }
    }
}
