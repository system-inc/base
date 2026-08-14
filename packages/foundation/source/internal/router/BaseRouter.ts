// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
import { cors as ittyCors, Route, RouterType, withCookies } from 'itty-router';

import { namedConfigurationGetValue } from '@system-inc/base-common/configuration/NamedConfiguration';
import { HTTP_HEADER_CACHE_CONTROL } from '@system-inc/base-common/http/HttpHeaders';
import { HttpMethodType } from '@system-inc/base-common/http/HttpMethod';
import {
    HttpStatus,
    HttpStatusCode,
} from '@system-inc/base-common/http/HttpStatus';
import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { BaseHandler } from '@system-inc/base-common/type/BaseHandler';
import {
    Constructor,
    isConstructor,
} from '@system-inc/base-common/type/Constructor';
import {
    isPrimitiveType,
    primitiveTypeCreate,
} from '@system-inc/base-common/type/PrimitiveType';
import {
    TypeFunc,
    typeFuncUnwrap,
} from '@system-inc/base-common/type/TypeFunc';
import { Mutable } from '@system-inc/base-common/type/UtilityTypes';
import { BaseConfiguration } from '../../configuration/BaseConfiguration';
import { BaseInjections } from '../../dependency-injection/BaseInjections';
import { extractTypeOrTokenFromErrorMessage } from '../../dependency-injection/InjectionErrors';
import { ArgumentValidationError } from '../../error/ArgumentValidationError';
import { BaseError } from '../../error/BaseError';
import {
    ERROR_CODE_INVALID_TYPE,
    ERROR_CODE_SERIALIZATION_ERROR,
} from '../../error/ErrorCode';
import { HttpErrors } from '../../error/HttpErrors';
import {
    UnhandledExceptionEvent,
    UnhandledExceptionEventName,
} from '../../event/UnhandledExceptionEvent';
import { HttpResponses } from '../../http/HttpResponses';
import { resolveRequestContextParams } from '../../request/decorators/RequestContextDecorator';
import { ResponseTransformer } from '../../router/ResponseTransformer';
import { deserialize } from '../../serialization/Deserialize';
import { validate } from '../../validation/ValidationEngine';
import {
    runHandlerMiddleware,
    runMiddlewareList,
} from '../middleware/Middleware';
import { BaseRequest } from '../request/BaseRequest';
import { RequestTimings } from '../request/RequestTimings';
import { ResponseBuilder } from '../request/ResponseBuilder';
import { IttyDummyRouter } from './DummyRouter';
import {
    routerMetadataGetRoutesWithInherited,
    RouterRouteMetadata,
} from './RouterMetadata';

export type RouteHandler = (
    request: BaseRequest,
) => Promise<Response | void> | Response | void;

/**
 * NOTE: Itty router is baked heavily into the system, after reviewing the additional
 * complications to the middleware stack it was determined that it was not worth the
 * effort to abstract it away.
 */

/**
 * Implementation of a Router that creates routes from decorated classes.
 * Uses the Itty router internally to power the routes.
 */
export class BaseRouter {
    readonly itty: RouterType<Route, any[], Response>;

    get isBound(): boolean {
        return this._isBound;
    }
    private _isBound: boolean = false;

    private readonly configuration: BaseConfiguration;

    private corsPair: ReturnType<typeof ittyCors> | undefined;

    constructor(
        router: RouterType<Route, any[]>,
        configuration: BaseConfiguration,
    ) {
        if (router instanceof IttyDummyRouter) {
            Logger.warn(
                LogCategory.Http,
                'Using the dummy router, no routes will be created.',
            );
        }
        this.itty = router;
        this.configuration = configuration;
    }

    bindRoutes() {
        // only bind the routes once.
        if (this.isBound) {
            Logger.warn(LogCategory.Http, 'Router already initialized');
            return;
        }

        // add all the routes to the router
        this.createServiceRoutes();

        // Build the itty CORS pair once. Used inline in handleRequest for
        // both preflight short-circuiting and response header application.
        const corsSettings = this.configuration.router?.cors;
        if (corsSettings) {
            const env = this.configuration.runtime.environment.type;
            this.corsPair = ittyCors({
                origin: corsSettings.allowedOrigins
                    ? namedConfigurationGetValue(
                          corsSettings.allowedOrigins,
                          env,
                      )
                    : undefined,
                credentials: corsSettings.allowCredentials ? true : undefined,
                allowMethods: corsSettings.allowedMethods,
                allowHeaders: corsSettings.allowedHeaders,
                exposeHeaders: corsSettings.exposedHeaders,
                maxAge: corsSettings.maxAge,
            });
        }

        // Attach the global middleware to the built-in routes too, so it runs
        // for every request — including /__version and unmatched (404)
        // requests — matching the documented "runs per request, before
        // dispatch" contract. Registered service routes get it via
        // _createRoute.
        const globalMiddleware = this.withGlobalMiddleware.bind(this);

        this.itty.get('/__version', globalMiddleware, () => {
            return Response.json(this.configuration.getVersionInfo(), {
                headers: {
                    [HTTP_HEADER_CACHE_CONTROL]: 'no-store',
                },
            });
        });

        this.itty.all('*', globalMiddleware, async (_request) => {
            return HttpResponses.fromError(HttpErrors.notFound());
        });

        this._isBound = true;
    }

    createRoute(
        method: HttpMethodType | HttpMethodType[],
        route: string,
        ...handlers: RouteHandler[]
    ): void {
        // make sure we don't create routes after the router has been bound.
        if (this.isBound) {
            throw new Error(
                'Router already bound. Routes must be created before bindRoutes() is called.',
            );
        }
        if (Array.isArray(method)) {
            this._createRoute(method, route, ...handlers);
        } else {
            this._createRoute([method], route, ...handlers);
        }
    }

    async handleRequest(request: BaseRequest): Promise<Response> {
        const corsSettings = this.configuration.router?.cors;

        // CORS preflight — short-circuit *real browser preflights* before
        // they reach the router. Real preflights always carry the
        // `Access-Control-Request-Method` header; gating on it lets
        // plain OPTIONS calls (e.g. tooling, app-defined OPTIONS routes)
        // route normally. itty's `preflight` doesn't gate, so we do it
        // here.
        if (
            corsSettings?.preflight &&
            this.corsPair &&
            request.headers.get('access-control-request-method')
        ) {
            const preflightResponse = this.corsPair.preflight(request);
            if (preflightResponse) {
                return preflightResponse;
            }
        }

        // run the route handler and create the response.
        let response = await this.itty
            .fetch(request)
            .catch((error: number | Error) => this.handleError(error, request));

        // check for any response transformers and run them.
        response = await this.runResponseTransformers(request, response);

        // apply CORS headers to the final response.
        // Skipped for WebSocket upgrade responses (headers immutable) and
        // redirect responses (browsers evaluate CORS on the followup request).
        if (this.corsPair && !shouldSkipCorsHeaders(request, response)) {
            response = this.corsPair.corsify(response, request);
        }

        return response;
    }

    private createServiceRoutes() {
        // Iterate the registered services (not the raw metadata registry) so
        // that only services this worker registered get routes, and collect
        // each one's routes including those inherited from base classes.
        for (const service of this.configuration.router.services) {
            const routes = routerMetadataGetRoutesWithInherited(service);
            const routeValues = Object.values(routes);
            if (routeValues.length === 0) {
                Logger.warn(
                    LogCategory.Http,
                    'No routes found for service %s.',
                    service.name,
                );
                continue;
            }
            for (const [handlerName, route] of Object.entries(routes)) {
                if (!route) {
                    continue;
                }
                // A method decorated with HTTP parameter decorators but no
                // @HttpRoute leaves a placeholder (empty routeHandler). It
                // would otherwise register a broken GET '' route — fail loud
                // instead so the missing @HttpRoute is caught at boot.
                if (!route.routeHandler) {
                    throw new Error(
                        `Handler '${service.name}.${handlerName}' has HTTP ` +
                            `parameter decorators but no @HttpRoute. Add ` +
                            `@HttpRoute, or remove the parameter decorators.`,
                    );
                }
                this.createServiceRoute(service, route);
            }
        }
    }

    private createServiceRoute(
        service: Constructor<object>,
        route: RouterRouteMetadata,
    ) {
        const path = !route.path.startsWith('/')
            ? `/${route.path}`
            : route.path;

        // add the route to the router.
        this.createRoute(route.method, path, async (request) => {
            request.context.stopWatch.split(RequestTimings.Middleware);

            // Resolve the handler and run handler middleware — access control
            // (session access) runs first of all — BEFORE binding,
            // deserializing, or validating any arguments. Otherwise an
            // unauthenticated caller to a protected endpoint would exercise
            // the deserialization/validation code and receive a 422 (leaking
            // the input schema) ahead of the 401. The handler identity comes
            // from route metadata, so this needs no bound arguments.
            const handler = new BaseHandler(service, route.routeHandler);
            request.context.handler = handler;
            const handlerMiddlewareResponse = await runHandlerMiddleware(
                request.context,
                handler,
            );
            if (handlerMiddlewareResponse) {
                return handlerMiddlewareResponse;
            }

            // create the argument list for the route handler.
            const routeArguments: any[] = [];
            const parameters = route.parameters;
            if (parameters) {
                for (const parameter of parameters) {
                    // Sparse entries appear when the handler has a parameter
                    // with no HTTP decorator between decorated ones (e.g.,
                    // an `@InjectRequestContext(KEY)` slot). Skip the hole
                    // and let `resolveRequestContextParams` fill its slot
                    // by index further down.
                    if (!parameter) {
                        continue;
                    }

                    const resolveArgument = async (
                        params: any,
                    ): Promise<any> => {
                        if (parameter.name) {
                            const parameterName = parameter.name;
                            if (parameter.typeFunc) {
                                const typeConversionFunction = typeFuncUnwrap(
                                    parameter.typeFunc,
                                );
                                if (
                                    isConstructor(typeConversionFunction) &&
                                    isPrimitiveType(typeConversionFunction)
                                ) {
                                    return this.resolvePrimitiveParameter(
                                        typeConversionFunction,
                                        params[parameterName],
                                        parameter.name,
                                    );
                                }
                                return this.convertNamedParameter(
                                    typeConversionFunction,
                                    params[parameterName],
                                    parameter.name,
                                );
                            }
                            return params[parameterName];
                        }
                        if (parameter.typeFunc) {
                            return await this.deserializeAndValidateParameter(
                                params,
                                parameter.typeFunc,
                            );
                        }
                        Logger.warn(
                            LogCategory.Http,
                            'Parameter must have a name or type.',
                        );
                        return undefined;
                    };

                    let value: any;
                    let skip = false;
                    if (parameter.metadataType === 'Headers') {
                        if (parameter.name) {
                            value = await resolveArgument({
                                [parameter.name]: request.headers.get(
                                    parameter.name,
                                ),
                            });
                        } else {
                            Logger.warn(
                                LogCategory.Http,
                                'Header parameter must have a name.',
                            );
                            skip = true;
                        }
                    } else if (parameter.metadataType === 'Cookies') {
                        value = await resolveArgument(request.cookies);
                    } else if (parameter.metadataType === 'Path') {
                        const decodedParams = this.decodeParameterIfNeeded(
                            request.params,
                            parameter.name,
                            parameter.options?.decode !== false,
                        );
                        value = await resolveArgument(decodedParams);
                    } else if (parameter.metadataType === 'Query') {
                        // itty builds request.query from URLSearchParams, whose
                        // values are already percent-decoded — decoding again
                        // would corrupt any value whose decoded form contains a
                        // valid %XX sequence. (Path params are not pre-decoded,
                        // so those still go through decodeParameterIfNeeded.)
                        value = await resolveArgument(request.query);
                    } else if (parameter.metadataType === 'Body') {
                        const mode = parameter.options?.mode ?? 'json';
                        switch (mode) {
                            case 'json': {
                                // With a typeFunc, deserialize + class-validate
                                // through resolveArgument. Without one, pass the
                                // parsed JSON through directly — symmetric with
                                // the other body modes, which never enter
                                // resolveArgument. The prior shape sent the
                                // parsed body into resolveArgument unconditionally,
                                // and the no-name / no-typeFunc fall-through
                                // returned undefined while warning "Parameter
                                // must have a name or type."
                                const parsedBody =
                                    await this.parseJsonBody(request);
                                if (parameter.typeFunc) {
                                    value = await resolveArgument(parsedBody);
                                } else {
                                    value = parsedBody;
                                }
                                break;
                            }
                            case 'stream':
                                value = request.body;
                                break;
                            case 'formData':
                                value = await request.formData();
                                break;
                            case 'text':
                                value = await request.text();
                                break;
                            case 'arrayBuffer':
                                value = await request.arrayBuffer();
                                break;
                            case 'blob':
                                value = await request.blob();
                                break;
                        }
                    }

                    if (!skip) {
                        // Store by the parameter's declared index, not via
                        // push, so `@InjectRequestContext`-only slots keep
                        // their positions when mixed with HTTP decorators.
                        routeArguments[parameter.index] = value;
                    }
                }
            }

            // resolve the http service from the container (after access
            // control, so an unauthorized request never instantiates it).
            const httpServiceInstance = request.context.container.resolve(
                service as Constructor<object>,
            );

            // resolve any @InjectRequestContext() decorated parameters
            resolveRequestContextParams(
                Object.getPrototypeOf(httpServiceInstance),
                route.routeHandler,
                request.context,
                routeArguments,
            );

            // call the route handler on the http service.
            let response = await (httpServiceInstance as any)[
                route.routeHandler
            ](...routeArguments);
            request.context.stopWatch.split(RequestTimings.Handler);

            // if the response isn't a response then lets make it one
            if (!response) {
                response = HttpResponses.ok();
            } else if (!(response instanceof Response)) {
                if (typeof response === 'object') {
                    response = Response.json(response);
                } else {
                    response = new Response(response);
                }
            }
            return response;
        });
    }

    private async deserializeAndValidateParameter(
        param: any,
        typeFunc: TypeFunc,
    ): Promise<any> {
        const typedObject = deserialize(param, typeFunc);
        if (typeof typedObject === 'object' && typedObject !== null) {
            const validationErrors = await validate(typedObject);
            if (validationErrors.length > 0) {
                Logger.debug(
                    LogCategory.Http,
                    'Router validation errors:',
                    validationErrors,
                );
                throw new ArgumentValidationError(validationErrors);
            }
        }
        return typedObject;
    }

    /**
     * Parse a JSON request body, converting a parse failure (empty or
     * malformed JSON) into a 400 rather than letting the SyntaxError surface
     * as a 500.
     */
    private async parseJsonBody(request: BaseRequest): Promise<unknown> {
        try {
            return await request.json();
        } catch {
            throw HttpErrors.badRequest({
                message: 'Request body is not valid JSON.',
                errorCode: ERROR_CODE_SERIALIZATION_ERROR,
            });
        }
    }

    /**
     * Convert a named parameter whose declared type is a non-primitive. The
     * decorator docs describe this as "an object type that takes the value
     * as a string argument and returns the typed result", so construct it
     * with the raw value (or, for a plain converter function, call it).
     */
    private convertNamedParameter(
        typeFunction: unknown,
        rawValue: unknown,
        parameterName: string | undefined,
    ): unknown {
        if (rawValue === undefined || rawValue === null) {
            throw HttpErrors.badRequest({
                message: `'${parameterName}' is required`,
                errorCode: ERROR_CODE_INVALID_TYPE,
            });
        }
        if (isConstructor(typeFunction)) {
            return new typeFunction(rawValue);
        }
        return (typeFunction as (value: unknown) => unknown)(rawValue);
    }

    /**
     * Convert a raw HTTP parameter value (always a string, or absent) to a
     * primitive type. HTTP-specific parsing, deliberately not the generic
     * `primitiveTypeCreate` truthiness: an absent value is rejected rather
     * than fabricated ("undefined"/"null"/0/true), the string "false" is
     * boolean false, and an empty string is a valid String but not a valid
     * Number.
     */
    private resolvePrimitiveParameter(
        typeConstructor: Constructor,
        rawValue: unknown,
        parameterName: string | undefined,
    ): unknown {
        // Absent value: reject rather than coerce a fabricated value.
        if (rawValue === undefined || rawValue === null) {
            throw HttpErrors.badRequest({
                message: `'${parameterName}' is required`,
                errorCode: ERROR_CODE_INVALID_TYPE,
            });
        }

        // Booleans arrive as strings; Boolean("false") is true, so parse
        // the string explicitly.
        if (typeConstructor.name === 'Boolean') {
            const normalized = String(rawValue).trim().toLowerCase();
            if (normalized === 'true' || normalized === '1') {
                return true;
            }
            if (
                normalized === 'false' ||
                normalized === '0' ||
                normalized === ''
            ) {
                return false;
            }
            throw HttpErrors.badRequest({
                message: `'${parameterName}' is not a valid Boolean`,
                errorCode: ERROR_CODE_INVALID_TYPE,
            });
        }

        // Numbers: an empty/blank string coerces to 0, and non-numeric
        // strings to NaN — reject both.
        if (typeConstructor.name === 'Number') {
            if (typeof rawValue === 'string' && rawValue.trim() === '') {
                throw HttpErrors.badRequest({
                    message: `'${parameterName}' is not a valid Number`,
                    errorCode: ERROR_CODE_INVALID_TYPE,
                });
            }
            const numberValue = primitiveTypeCreate(typeConstructor, rawValue);
            if (Number.isNaN(numberValue)) {
                throw HttpErrors.badRequest({
                    message: `'${parameterName}' is not a valid Number`,
                    errorCode: ERROR_CODE_INVALID_TYPE,
                });
            }
            return numberValue;
        }

        // String (empty string is valid) and the remaining primitives.
        return primitiveTypeCreate(typeConstructor, rawValue);
    }

    private decodeParameterIfNeeded(
        params: Record<string, any>,
        parameterName: string | undefined,
        shouldDecode: boolean = true,
    ): Record<string, any> {
        // If decoding is disabled or no parameter name, return params as-is
        if (!shouldDecode || !parameterName) {
            return params;
        }

        // Create a copy to avoid mutating the original
        const decodedParams = { ...params };

        // Decode the specific parameter if it exists
        if (
            decodedParams[parameterName] &&
            typeof decodedParams[parameterName] === 'string'
        ) {
            try {
                decodedParams[parameterName] = decodeURIComponent(
                    decodedParams[parameterName],
                );
            } catch (e) {
                // If decoding fails (e.g., malformed URI), keep the original value
                Logger.warn(
                    LogCategory.Http,
                    "Failed to decode parameter '%s':",
                    parameterName,
                    e,
                );
            }
        }

        return decodedParams;
    }

    private async runResponseTransformers(
        request: BaseRequest,
        response: Response,
    ): Promise<Response> {
        // if we have an upgrade request we need to skip any response transforms,
        // e.g. CORS, SET-COOKIE, etc. as these headers are immutable
        if (request?.headers.get('upgrade')) {
            return response;
        }

        // Redirects are NOT skipped: HttpResponses.redirect now builds them
        // with mutable headers, so cookies/headers set by the handler must be
        // applied here too (previously a 303 returned early and lost them).

        // Resolve response transformers. An "unregistered token" error means
        // no transformers were registered — legitimate empty case, treat as
        // []. Any other error (e.g., a registered transformer failed to
        // instantiate) is a real bug and must propagate.
        let responseTransformers: ResponseTransformer[] = [];
        try {
            responseTransformers = request.context.container.resolveAll(
                BaseInjections.ResponseTransformer,
            );
        } catch (e) {
            if (
                !(e instanceof Error) ||
                extractTypeOrTokenFromErrorMessage(e.message) !==
                    BaseInjections.ResponseTransformer
            ) {
                throw e;
            }
        }

        for (const transformer of responseTransformers) {
            response = await transformer.transformResponse(
                response,
                request.context,
            );
        }

        // apply any response data from the request to the response (headers and cookies)
        if (request.context.response instanceof ResponseBuilder) {
            request.context.response.applyToResponse(response);
        }

        return response;
    }

    private handleError(
        statusCodeOrError: number | Error,
        request?: BaseRequest,
    ): Response {
        let baseError: BaseError;
        if (statusCodeOrError instanceof Error) {
            const { safe, raw, masked } =
                BaseError.forClient(statusCodeOrError);
            if (masked) {
                Logger.error(LogCategory.Http, '%o', raw);
                // an error the app didn't model escaped the handler —
                // surface it to unhandled-exception listeners after the
                // response goes out
                request?.context.eventBus.defer<UnhandledExceptionEvent>({
                    name: UnhandledExceptionEventName,
                    error: raw,
                    surface: 'http',
                    requestId: request.context.requestId,
                    ipAddress: request.context.ipAddress,
                    userAgent: request.context.userAgent,
                    detail: `${request.method} ${request.route}`,
                });
            }
            baseError = safe;
        } else {
            const statusCode: HttpStatusCode = HttpStatus.isValidHttpStatus(
                statusCodeOrError,
            )
                ? statusCodeOrError
                : HttpStatusCode.InternalServerError;
            baseError = BaseError.fromHttpStatus(statusCode);
        }
        return HttpResponses.fromError(baseError);
    }

    private _createRoute(
        methods: HttpMethodType[],
        route: string,
        ...handlers: RouteHandler[]
    ): void {
        const globalMiddleware = this.withGlobalMiddleware.bind(this);
        if (methods.includes('ALL')) {
            this.itty.all(route, globalMiddleware, ...handlers);
        } else {
            methods.forEach((method) => {
                this.itty[method](route, globalMiddleware, ...handlers);
            });
        }
    }

    /**
     * Global middleware that runs on every request, before any route handler.
     * Runs in this order:
     *   1. Parses cookies
     *   2. Mirrors cookies and route onto the RequestContext
     *   3. Runs all module-registered middleware in dependency order
     */
    private async withGlobalMiddleware(
        request: Mutable<BaseRequest>,
    ): Promise<Response | void> {
        // parse cookies
        withCookies(request);
        if (!request.cookies) {
            request.cookies = {};
        }

        // mirror cookies and route onto the RequestContext
        request.context.cookies = request.cookies;
        request.context.route = request.route;

        // run module-registered global middleware in dependency order
        return runMiddlewareList(
            this.configuration.middleware.global,
            request.context,
        );
    }
}

/**
 * CORS headers should not be applied to WebSocket upgrade responses
 * (their headers are immutable) nor to redirect responses (browsers
 * evaluate CORS on the follow-up request, not the redirect itself).
 */
export function shouldSkipCorsHeaders(
    request: Request,
    _response: Response,
): boolean {
    // Only WebSocket upgrade responses skip CORS (their 101 headers are
    // immutable). Redirects are NOT skipped: per the Fetch spec a CORS-mode
    // fetch checks Access-Control-Allow-Origin on the redirect response
    // itself before following it, so a 3xx without CORS headers fails the
    // cross-origin fetch. corsify clones the response, so applying headers is
    // safe even when the original headers are immutable.
    return request.headers.get('upgrade') !== null;
}
