// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { StopWatch } from '@system-inc/base-common/time/StopWatch';
import { BaseHandler } from '@system-inc/base-common/type/BaseHandler';
import type { BaseConfiguration } from '../configuration/BaseConfiguration';
import { BaseInjectionContainer } from '../dependency-injection/BaseInjectionContainer';
import { BaseEventBus } from '../event/BaseEventBus';
import { GqlContext } from '../internal/graphql/GqlContext';
import { DeferredActions } from './DeferredActions';
import { RequestContextKey } from './RequestContextKey';
import { RequestOrigin } from './RequestOrigin';
import { ResponseWriter } from './ResponseWriter';

export interface RoutingInfo {
    readonly originType: 'public' | 'internal';
    readonly origin?: string;
}

/**
 * The application-facing context for the current request.
 *
 * `RequestContext` provides a safe, structured projection of the incoming
 * request. It exposes the metadata and capabilities that application code
 * typically needs — HTTP metadata, caller info, DI, and response
 * control — without exposing the raw `Request` body or stream methods
 * that could lead to accidental data leaks.
 *
 * All framework-owned fields are `readonly` from the application's
 * perspective. The framework populates them on the underlying concrete
 * implementation; app code reads them and may only write to its own
 * typed-key extension bag via {@link set}, {@link get}, and
 * {@link require}.
 *
 * Module-specific concerns (device ID, session, account, etc.) should be
 * stored and retrieved via the typed extension mechanism using
 * {@link RequestContextKey}.
 *
 * Obtain an instance via the `@InjectRequestContext()` parameter decorator.
 */
export interface RequestContext<PlatformType = unknown> {
    /**
     * Unique identifier for this request.
     */
    readonly requestId: string;

    /**
     * The full URL of the incoming request.
     */
    readonly url: string;

    /**
     * The HTTP method of the incoming request (GET, POST, etc.).
     */
    readonly method: string;

    /**
     * The matched route path.
     */
    readonly route: string;

    /**
     * The HTTP headers from the incoming request.
     */
    readonly headers: Headers;

    /**
     * The parsed cookies from the incoming request.
     */
    readonly cookies: Readonly<Record<string, string>>;

    /**
     * The IP address of the caller, if available.
     */
    readonly ipAddress?: string;

    /**
     * The user agent string of the caller.
     */
    readonly userAgent: string;

    /**
     * Geographic and locale information derived from the request
     * (country, timezone, language preferences, etc.).
     */
    readonly origin: RequestOrigin;

    /**
     * The application configuration.
     */
    readonly configuration: BaseConfiguration;

    /**
     * The dependency injection container scoped to this request.
     */
    readonly container: BaseInjectionContainer;

    /**
     * Response data that will be sent back to the client.
     * Use this to set cookies or append headers to the response.
     */
    readonly response: ResponseWriter;

    /**
     * Deferred actions to run asynchronously after the response is sent.
     */
    readonly deferred: DeferredActions;

    /**
     * Event bus for emitting events related to this request.
     */
    readonly eventBus: BaseEventBus;

    /**
     * Stop watch for the request.
     */
    readonly stopWatch: StopWatch;

    /**
     * Platform-specific properties about/for the request.
     */
    readonly platform: PlatformType | undefined;

    /**
     * Whether this request is a GraphQL request.
     */
    readonly isGraphQL: boolean;

    /**
     * If this request is a GraphQL request, the GraphQL context.
     */
    readonly graphql: Omit<GqlContext, 'request'> | undefined;

    /**
     * Whether this request is an RPC request.
     */
    readonly isRpc: boolean;

    /**
     * If this request is an RPC request, the name of the procedure being called.
     */
    readonly rpc: string | undefined;

    /**
     * Information about the handler method being invoked for this request.
     * Undefined before dispatch or for framework routes that don't map to a
     * handler (e.g., /__version).
     */
    readonly handler: BaseHandler | undefined;

    /**
     * Whether this request originated from an internal (service-to-service) caller.
     */
    readonly isInternal: boolean;

    /**
     * Origin / routing information derived from the request.
     */
    readonly routing: RoutingInfo;

    /**
     * Set a typed extension value on this request context.
     * Use this from middleware to attach per-request data.
     */
    set<T>(key: RequestContextKey<T>, value: T): void;

    /**
     * Get a typed extension value from this request context.
     */
    get<T>(key: RequestContextKey<T>): T | undefined;

    /**
     * Get a typed extension value from this request context, throwing if
     * it's not set.
     */
    require<T>(key: RequestContextKey<T>): T;
}
