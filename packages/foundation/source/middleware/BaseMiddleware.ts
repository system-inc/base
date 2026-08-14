// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { HandlerRequestContext } from '../request/HandlerRequestContext';
import { RequestContext } from '../request/RequestContext';

/**
 * A middleware function. Runs for each request.
 *
 * Return `void` to continue to the next middleware.
 * Return a `Response` to short-circuit the pipeline.
 * Throw an `Error` to signal a failure.
 */
export type BaseMiddlewareFn = (
    requestContext: RequestContext,
) => Promise<Response | void> | Response | void;

/**
 * A class-based middleware. Runs for each request via `run()`.
 *
 * Prefer classes when you need dependency injection. Otherwise
 * {@link BaseMiddlewareFn} is simpler.
 */
export interface BaseMiddleware {
    run(
        requestContext: RequestContext,
    ): Promise<Response | void> | Response | void;
}

/**
 * What modules register as middleware — either a class or a function.
 */
export type BaseMiddlewareRegistration =
    | Constructor<BaseMiddleware>
    | BaseMiddlewareFn;

/**
 * A handler-scoped middleware function. Runs after the dispatcher has
 * resolved the handler, so `rc.handler` is guaranteed to be present.
 *
 * Same short-circuit semantics as {@link BaseMiddlewareFn}.
 */
export type HandlerMiddlewareFn = (
    requestContext: HandlerRequestContext,
) => Promise<Response | void> | Response | void;

/**
 * A class-based handler-scoped middleware. Runs after the dispatcher
 * has resolved the handler, so `rc.handler` is guaranteed to be present.
 *
 * Prefer classes when you need dependency injection.
 */
export interface HandlerMiddleware {
    run(
        requestContext: HandlerRequestContext,
    ): Promise<Response | void> | Response | void;
}

/**
 * What modules register as handler-scoped middleware — either a class
 * or a function. Registered via `ModuleSettings.middleware.handler` or
 * attached directly to a handler via `@WithMiddleware`.
 */
export type HandlerMiddlewareRegistration =
    | Constructor<HandlerMiddleware>
    | HandlerMiddlewareFn;

/**
 * Whether a middleware registration is a class constructor (which is
 * resolved from the container, so it participates in DI and database
 * attribution) rather than a plain function.
 */
export function isMiddlewareConstructor(
    value: BaseMiddlewareRegistration,
): value is Constructor<BaseMiddleware> {
    return (
        typeof value === 'function' &&
        value.prototype !== undefined &&
        typeof value.prototype.run === 'function'
    );
}

export function isHandlerMiddlewareConstructor(
    value: HandlerMiddlewareRegistration,
): value is Constructor<HandlerMiddleware> {
    return (
        typeof value === 'function' &&
        value.prototype !== undefined &&
        typeof value.prototype.run === 'function'
    );
}
