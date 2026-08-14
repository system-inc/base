// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseHandler } from '@system-inc/base-common/type/BaseHandler';
import { getBaseMetadata } from '../../base/BaseMetadata';
import {
    BaseMiddlewareRegistration,
    HandlerMiddlewareRegistration,
    isHandlerMiddlewareConstructor,
    isMiddlewareConstructor,
} from '../../middleware/BaseMiddleware';
import { HandlerRequestContext } from '../../request/HandlerRequestContext';
import { RequestContext } from '../../request/RequestContext';
import { runSessionAccessMiddleware } from '../access-control/SessionAccessMiddleware';

/**
 * Runs a single middleware registration (function or class). Class
 * middleware is resolved from the request-scoped DI container.
 *
 * Returns whatever the middleware returns — `void` to continue, a
 * `Response` to short-circuit.
 */
export async function runMiddleware(
    middleware: BaseMiddlewareRegistration,
    requestContext: RequestContext,
): Promise<Response | void> {
    if (isMiddlewareConstructor(middleware)) {
        const instance = requestContext.container.resolve(middleware);
        return instance.run(requestContext);
    }
    return middleware(requestContext);
}

/**
 * Runs a list of middleware in order. Stops and returns the first
 * `Response` produced by any middleware (short-circuit). Returns `void`
 * if all middleware ran without short-circuiting.
 */
export async function runMiddlewareList(
    middlewares: ReadonlyArray<BaseMiddlewareRegistration>,
    requestContext: RequestContext,
): Promise<Response | void> {
    for (const middleware of middlewares) {
        const response = await runMiddleware(middleware, requestContext);
        if (response) {
            return response;
        }
    }
}

/**
 * Runs all handler-scoped middleware for the request's current handler.
 *
 * This covers:
 *   0. Access-control enforcement for `@RequireSessionAccess` /
 *      `@WithSessionAccess` handlers (a handler without access-control
 *      metadata passes straight through). Runs first — unconditionally,
 *      so a decorated handler can never go unenforced by a missed
 *      registration — and before other middleware so they observe the
 *      resolved session.
 *   1. Module-registered handler middleware (from `configuration.middleware.handler`)
 *   2. `@WithMiddleware`-decorated middleware on the resolved handler class/method
 *
 * The dispatcher passes the resolved `handler` explicitly (rather than this
 * function reading `rc.handler`) so that concurrently-executing GraphQL
 * sibling fields — which share one RequestContext — each enforce their OWN
 * handler's access control and `@WithMiddleware`, instead of racing on a
 * shared mutable `rc.handler` slot. Dispatchers still set `rc.handler` for
 * user middleware and deferred actions that read it.
 */
export async function runHandlerMiddleware(
    requestContext: RequestContext,
    handler: BaseHandler,
): Promise<Response | void> {
    const handlerRequestContext = requestContext as HandlerRequestContext;

    // 0. access-control enforcement (throws 401/403 on failure)
    await runSessionAccessMiddleware(handlerRequestContext, handler);

    // 1. module-registered handler middleware
    const moduleResponse = await runHandlerMiddlewareList(
        requestContext.configuration.middleware.handler,
        handlerRequestContext,
    );
    if (moduleResponse) {
        return moduleResponse;
    }

    // 2. @WithMiddleware-decorated middleware for this handler
    const decoratorMiddleware =
        getBaseMetadata().middleware.getMiddlewareForHandler(handler);
    if (!decoratorMiddleware) {
        return;
    }

    return runHandlerMiddlewareList(decoratorMiddleware, handlerRequestContext);
}

/**
 * Runs a list of handler-scoped middleware in order. Same short-circuit
 * semantics as {@link runMiddlewareList}.
 */
async function runHandlerMiddlewareList(
    middlewares: ReadonlyArray<HandlerMiddlewareRegistration>,
    requestContext: HandlerRequestContext,
): Promise<Response | void> {
    for (const middleware of middlewares) {
        const response = await runHandlerMiddlewareOne(
            middleware,
            requestContext,
        );
        if (response) {
            return response;
        }
    }
}

async function runHandlerMiddlewareOne(
    middleware: HandlerMiddlewareRegistration,
    requestContext: HandlerRequestContext,
): Promise<Response | void> {
    if (isHandlerMiddlewareConstructor(middleware)) {
        const instance = requestContext.container.resolve(middleware);
        return instance.run(requestContext);
    }
    return middleware(requestContext);
}
