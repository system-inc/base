// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { HTTP_HEADER_USER_AGENT } from '@system-inc/base-common/http/HttpHeaders';
import { DefaultRpcEndpoint } from '@system-inc/base-common/rpc/protocol/DefaultRpcEndpoint';
import type { StopWatch } from '@system-inc/base-common/time/StopWatch';
import { BaseHandler } from '@system-inc/base-common/type/BaseHandler';
import { UNKNOWN_USER_AGENT } from '@system-inc/base-common/user-agent/UnknownUserAgent';
import type { BaseConfiguration } from '../../configuration/BaseConfiguration';
import { BaseInjectionContainer } from '../../dependency-injection/BaseInjectionContainer';
import { BaseInjections } from '../../dependency-injection/BaseInjections';
import { BaseEventBus } from '../../event/BaseEventBus';
import { DeferredActions } from '../../request/DeferredActions';
import { RequestContext, RoutingInfo } from '../../request/RequestContext';
import { RequestContextKey } from '../../request/RequestContextKey';
import { RequestOrigin } from '../../request/RequestOrigin';
import { ResponseWriter } from '../../request/ResponseWriter';
import { BaseWorkerPlatformDelegate } from '../../worker/BaseWorkerPlatformDelegate';
import { GqlContext } from '../graphql/GqlContext';
import { InternalBaseRequest } from './InternalBaseRequest';
import { ResponseBuilder } from './ResponseBuilder';

export interface RequestContextArgs<PlatformType = unknown> {
    request: Request;
    configuration: BaseConfiguration;
    container: BaseInjectionContainer;
    stopWatch: StopWatch;
    platformDelegate: BaseWorkerPlatformDelegate<PlatformType>;
}

/**
 * The concrete, framework-internal implementation of {@link RequestContext}.
 *
 * `BaseRequestContext` is the one and only runtime class that carries a
 * request's state through the framework. It exposes writable framework
 * fields (`route`, `cookies`, `graphql`, `rpc`, `handler`) so dispatchers
 * can populate them as the request is resolved.
 *
 * Application code never sees this class directly — the `@InjectRequestContext`
 * decorator and all handler parameter surfaces type the request context as
 * the read-only {@link RequestContext} interface, preventing app code from
 * mutating framework-owned fields. Under the covers it's always this class.
 */
export class BaseRequestContext<
    PlatformType = unknown,
> implements RequestContext<PlatformType> {
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
     * The matched route path. Set by the dispatcher.
     */
    route: string;

    /**
     * The HTTP headers from the incoming request.
     */
    readonly headers: Headers;

    /**
     * The parsed cookies from the incoming request. Set by the dispatcher.
     */
    cookies: Readonly<Record<string, string>>;

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
    get response(): ResponseWriter {
        if (!this._responseData) {
            this._responseData = new ResponseBuilder();
        }
        return this._responseData;
    }
    private _responseData: ResponseBuilder | undefined = undefined;

    /**
     * Deferred actions to run asynchronously after the response is sent.
     */
    get deferred(): DeferredActions {
        return this.container.resolve(
            BaseInjections.DeferredActions.toString(),
        );
    }

    /**
     * Event bus for emitting events related to this request.
     */
    get eventBus(): BaseEventBus {
        return this.container.resolve(BaseEventBus);
    }

    /**
     * Get the stop watch for the request.
     */
    readonly stopWatch: StopWatch;

    /**
     * Additional properties about/for the request that are specific to the platform.
     */
    readonly platform: PlatformType | undefined;

    get isGraphQL(): boolean {
        // `graphql.route` is optional in settings; `Base` falls back to
        // `/graphql` when registering the route. Mirror the same fallback
        // here so GraphQL requests are recognised even when settings
        // don't name the route explicitly.
        if (!this.configuration.graphql) {
            return false;
        }
        const graphqlRoute = this.configuration.graphql.route ?? '/graphql';
        return this.route === graphqlRoute;
    }

    /**
     * If this request is a GraphQL request, this will be the GraphQL
     * context for the request. Set by the GraphQL dispatcher.
     */
    graphql: GqlContext | undefined = undefined;

    /**
     * Whether this request is an RPC request.
     * Determined by matching the request route to the configured RPC route.
     */
    get isRpc(): boolean {
        // Mirror the `Base.ts` fallback to `DefaultRpcEndpoint` when
        // `rpcServer.route` isn't explicitly configured — otherwise RPC
        // requests look like plain HTTP here.
        if (!this.configuration.rpcServer) {
            return false;
        }
        const rpcRoute =
            this.configuration.rpcServer.route ?? DefaultRpcEndpoint;
        return this.route === rpcRoute;
    }

    /**
     * If this request is an RPC request, this will be the name of the
     * remote procedure being called. Set by the RPC dispatcher.
     */
    rpc: string | undefined = undefined;

    /**
     * Information about the handler method being invoked for this request.
     * Set by the dispatcher once the specific handler is known.
     * Undefined before dispatch or for framework routes that don't map to a
     * handler (e.g., /__version).
     */
    handler: BaseHandler | undefined = undefined;

    get isInternal(): boolean {
        return this.routing.originType === 'internal';
    }

    get routing(): RoutingInfo {
        if (this._routing) {
            return this._routing;
        }

        const url = new URL(this.url);
        const isInternal = url.hostname.endsWith(
            InternalBaseRequest.HostNameSuffix,
        );
        const origin = url.host.substring(
            0,
            url.hostname.indexOf(InternalBaseRequest.HostNameSuffix),
        );
        this._routing = {
            originType: isInternal ? 'internal' : 'public',
            origin: isInternal ? origin : undefined,
        };

        return this._routing;
    }
    private _routing: RoutingInfo | undefined = undefined;

    private _extensions: Map<string, unknown> | undefined = undefined;

    constructor(args: RequestContextArgs<PlatformType>) {
        // Tracing
        this.requestId = crypto.randomUUID();

        // HTTP
        this.url = args.request.url;
        this.method = args.request.method;
        // this.route = args.request.route; // set later by middleware
        this.headers = args.request.headers;
        // this.cookies = args.request.cookies; // set later by middleware

        this.platform = args.platformDelegate.getPlatformRequestProperties(
            args.request,
        );

        // Caller
        this.userAgent =
            args.request.headers.get(HTTP_HEADER_USER_AGENT) ??
            UNKNOWN_USER_AGENT;
        this.ipAddress = args.platformDelegate.getRequestIpAddress(
            args.request,
        );

        // Geo / Locale
        this.origin = new RequestOrigin(args.request, args.platformDelegate);

        // Services
        this.configuration = args.configuration;
        this.container = args.container;
        this.stopWatch = args.stopWatch;
    }

    /**
     * Set a typed extension value on this request context.
     * Use this from middleware to attach per-request data.
     */
    set<T>(key: RequestContextKey<T>, value: T): void {
        if (!this._extensions) {
            this._extensions = new Map();
        }
        this._extensions.set(key.name, value);
    }

    /**
     * Get a typed extension value from this request context.
     */
    get<T>(key: RequestContextKey<T>): T | undefined {
        return this._extensions?.get(key.name) as T | undefined;
    }

    /**
     * Get a typed extension value from this request context, throwing an error if it's not set.
     *
     * @param key
     * @returns
     */
    require<T>(key: RequestContextKey<T>): T {
        const value = this.get(key);
        if (value === undefined) {
            throw new Error(
                `Required request context key "${key.name}" is missing.`,
            );
        }
        return value;
    }

    /**
     * Controls `JSON.stringify()` output.
     */
    toJSON() {
        return this.safeRepresentation();
    }

    /**
     * Controls string coercion (template literals, `String()`, `"" + obj`).
     */
    toString(): string {
        return `RequestContext(${this.method} ${this.route} [${this.requestId}])`;
    }

    /**
     * Controls `console.log()` output in Node.js and Cloudflare Workers.
     */
    [Symbol.for('nodejs.util.inspect.custom')]() {
        return this.safeRepresentation();
    }

    /**
     * Returns a safe representation for all serialization and logging paths.
     * Excludes the DI container, deferred actions, response internals,
     * headers, and cookies.
     */
    private safeRepresentation() {
        return {
            requestId: this.requestId,
            url: this.url,
            method: this.method,
            route: this.route,
            ipAddress: this.ipAddress,
            userAgent: this.userAgent,
            origin: this.origin,
            configuration: this.configuration,
            // container intentionally excluded
        };
    }
}
