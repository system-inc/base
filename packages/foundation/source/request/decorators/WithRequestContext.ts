// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { RequestContext } from '../RequestContext';
import { RequestContextKey } from '../RequestContextKey';
import {
    InjectRequestContext,
    REQUEST_CONTEXT_EXTRACTIONS_KEY,
    REQUEST_CONTEXT_METADATA_KEY,
} from './RequestContextDecorator';

/**
 * Callback invoked before the decorated method runs. Receives the
 * {@link RequestContext} for the current request. Throw to abort the call.
 */
export type RequestContextGuard = (
    requestContext: RequestContext,
) => void | Promise<void>;

/**
 * Builds a method decorator that runs a guard against the current
 * {@link RequestContext} before invoking the decorated method.
 *
 * Internally this registers an `@InjectRequestContext()` at a trailing slot
 * just past the method's declared arity. The dispatcher fills that slot
 * with the RC, the wrapper reads it, trims it off the args, runs the guard,
 * and then forwards the original args to the underlying method.
 *
 * Multiple decorators using this helper can be stacked on the same method —
 * each one gets its own trailing slot (the metadata is an array) and the
 * RC is written into every slot.
 *
 * Use this when a decorator only needs to pre-inspect the RC. For
 * post-invocation work or argument transformation, write a bespoke
 * decorator.
 *
 * @example
 * ```ts
 * export function RequireDeviceId(): MethodDecorator {
 *     return withRequestContext((rc) => {
 *         if (!rc.get(DeviceIdRequestContextKey)) {
 *             throw requireDeviceIdError();
 *         }
 *     });
 * }
 * ```
 */
export function withRequestContext(
    guard: RequestContextGuard,
): MethodDecorator {
    return function (
        target: object,
        propertyKey: string | symbol,
        descriptor: PropertyDescriptor,
    ) {
        const originalMethod = descriptor.value;

        // Pick a slot past every index that has already been registered
        // for this method. `originalMethod.length` is unreliable when
        // stacking with another `withRequestContext` decorator — the inner
        // wrapper is `async function (...args)` with arity 0, so reusing
        // it would collide with slot 0 (the first real argument). Reading
        // the existing metadata gives us a stable "next free slot".
        const existingIndices: number[] =
            Reflect.getMetadata(
                REQUEST_CONTEXT_METADATA_KEY,
                target,
                propertyKey,
            ) ?? [];
        const existingExtractions:
            | Map<number, RequestContextKey<unknown>>
            | undefined = Reflect.getMetadata(
            REQUEST_CONTEXT_EXTRACTIONS_KEY,
            target,
            propertyKey,
        );
        const maxRegistered = Math.max(
            -1,
            ...existingIndices,
            ...(existingExtractions ? [...existingExtractions.keys()] : []),
        );
        const injectedIndex = Math.max(
            originalMethod.length,
            maxRegistered + 1,
        );
        InjectRequestContext()(target, propertyKey, injectedIndex);

        descriptor.value = async function (...args: any[]) {
            const requestContext = args[injectedIndex] as RequestContext;
            args.length = injectedIndex;

            await guard(requestContext);

            return await originalMethod.apply(this, args);
        };
    };
}
