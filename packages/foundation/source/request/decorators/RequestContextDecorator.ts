// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import 'reflect-metadata';

import type { RequestContext } from '../RequestContext';
import { RequestContextKey } from '../RequestContextKey';

/**
 * Metadata key used to store the parameter indices for whole RequestContext injection.
 * Stored as `number[]` — multiple decorators (e.g., auth wrappers that append
 * a trailing RC arg programmatically) can register additional indices, and
 * the dispatcher writes the RC into every one of them.
 *
 * This key is intentionally a simple string so that it can be read from any
 * dispatch site — including the type-graphql fork — without importing
 * framework modules.
 */
export const REQUEST_CONTEXT_METADATA_KEY = 'base:requestContextIndex';

/**
 * Metadata key used to store the map of parameter index → RequestContextKey
 * for key-based extractions.
 */
export const REQUEST_CONTEXT_EXTRACTIONS_KEY = 'base:requestContextExtractions';

/**
 * Parameter decorator that injects the {@link RequestContext} or a specific
 * value from it into a method parameter.
 *
 * Works universally across HTTP routes, RPC handlers, and GraphQL resolvers.
 * Without a key it injects the entire `RequestContext`; with a
 * {@link RequestContextKey} it extracts that specific extension value from the
 * context's typed bag.
 *
 * @example
 * ```ts
 * // Without a key — the entire RequestContext
 * @HttpRoute('GET', '/api/foo')
 * async getFoo(
 *     @HttpPath('id') id: string,
 *     @InjectRequestContext() rc: RequestContext,
 * ): Promise<Response> {
 *     rc.deviceId;
 *     rc.headers.get('x-custom');
 * }
 *
 * // With a key — a specific extension value
 * const DeviceId = RequestContextKey.create<string>('deviceId');
 *
 * @Rpc()
 * async doThing(
 *     input: Input,
 *     @InjectRequestContext(DeviceId) deviceId?: string,
 * ): Promise<Output> { ... }
 * ```
 */
export function InjectRequestContext(): ParameterDecorator;
export function InjectRequestContext<T>(
    key: RequestContextKey<T>,
): ParameterDecorator;
export function InjectRequestContext<T>(
    key?: RequestContextKey<T>,
): ParameterDecorator {
    return (
        target: object,
        propertyKey: string | symbol | undefined,
        parameterIndex: number,
    ) => {
        if (propertyKey === undefined) return;

        if (key) {
            // Key-based extraction — store in the extractions map
            const existing: Map<
                number,
                RequestContextKey<unknown>
            > = Reflect.getMetadata(
                REQUEST_CONTEXT_EXTRACTIONS_KEY,
                target,
                propertyKey,
            ) ?? new Map();
            existing.set(parameterIndex, key);
            Reflect.defineMetadata(
                REQUEST_CONTEXT_EXTRACTIONS_KEY,
                existing,
                target,
                propertyKey,
            );
        } else {
            // Whole context injection — append this index so multiple
            // decorators can each request the RC at their own slot.
            const existing: number[] =
                Reflect.getMetadata(
                    REQUEST_CONTEXT_METADATA_KEY,
                    target,
                    propertyKey,
                ) ?? [];
            if (!existing.includes(parameterIndex)) {
                existing.push(parameterIndex);
            }
            Reflect.defineMetadata(
                REQUEST_CONTEXT_METADATA_KEY,
                existing,
                target,
                propertyKey,
            );
        }
    };
}

/**
 * Resolves all `@InjectRequestContext()` decorated parameters for a method.
 * Call this from dispatch sites (Router, RpcDispatcher, GqlDispatcher/TypeGraphQL)
 * to populate the args array with RequestContext data.
 *
 * @param prototype The prototype of the service instance
 * @param methodName The name of the method being called
 * @param requestContext The RequestContext for the current request
 * @param args The arguments array to populate
 */
export function resolveRequestContextParams(
    prototype: object,
    methodName: string | symbol,
    requestContext: RequestContext,
    args: unknown[],
): void {
    // Whole context injection — write the RC into every registered index
    const contextIndices: number[] | undefined = Reflect.getMetadata(
        REQUEST_CONTEXT_METADATA_KEY,
        prototype,
        methodName,
    );
    if (contextIndices) {
        for (const index of contextIndices) {
            args[index] = requestContext;
        }
    }

    // Key-based extractions
    const extractions: Map<number, RequestContextKey<unknown>> | undefined =
        Reflect.getMetadata(
            REQUEST_CONTEXT_EXTRACTIONS_KEY,
            prototype,
            methodName,
        );
    if (extractions) {
        for (const [index, key] of extractions) {
            args[index] = requestContext.get(key);
        }
    }
}
