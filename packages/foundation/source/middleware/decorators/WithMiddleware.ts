// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { getBaseMetadata } from '../../base/BaseMetadata';
import { HandlerMiddlewareRegistration } from '../BaseMiddleware';

/**
 * Decorator to add handler-scoped middleware to a class or method.
 *
 * Accepts either a middleware function or a middleware class constructor,
 * or an array of them. Classes are resolved from the DI container.
 *
 * The middleware runs after the dispatcher has resolved `rc.handler`, so
 * implementations receive a {@link HandlerRequestContext} in which
 * `rc.handler` is guaranteed to be set.
 *
 * @param middleware
 */
export function WithMiddleware(
    middleware: HandlerMiddlewareRegistration | HandlerMiddlewareRegistration[],
): ClassDecorator & MethodDecorator {
    return function (
        target: object | Function,
        propertyKey?: string | symbol,
        descriptor?: PropertyDescriptor,
    ) {
        if (!Array.isArray(middleware)) {
            middleware = [middleware];
        }
        if (target && propertyKey && descriptor) {
            // we are decorating a method
            getBaseMetadata().middleware.addMiddleware(
                `${target.constructor.name}.${propertyKey.toString()}`,
                middleware,
            );
        } else {
            // we are decorating a class
            getBaseMetadata().middleware.addMiddleware(
                (target as Function).name,
                middleware,
            );
        }
    };
}
