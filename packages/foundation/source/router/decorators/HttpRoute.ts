// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { HttpMethodType } from '@system-inc/base-common/http/HttpMethod';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { routerMetadataAddRoute } from '../../internal/router/RouterMetadata';

/**
 * Registers a method of an `@HttpService` class as the handler for an HTTP
 * route. Path parameters are declared as `:name` segments and read with
 * `@HttpPath`.
 *
 * @param method The HTTP method for the route, a list of methods to match, or
 * `'ALL'` to match every method.
 * @param route The path for the route, e.g. `/accounts/:id`.
 * @example
 * ```ts
 * @HttpRoute('GET', '/accounts/:id')
 * async get(@HttpPath('id') id: string): Promise<Response> { ... }
 *
 * // One handler for multiple methods
 * @HttpRoute(['GET', 'POST'], '/echo')
 * async echo(@InjectRequestContext() rc: RequestContext): Promise<Response> {
 *     return new Response(rc.method);
 * }
 * ```
 */
export function HttpRoute(
    method: HttpMethodType | HttpMethodType[],
    route: string,
): MethodDecorator {
    return (
        target: object,
        propertyKey: string | symbol,
        descriptor: PropertyDescriptor,
    ) => {
        routerMetadataAddRoute(target.constructor as Constructor, {
            path: route,
            method: method,
            parameterLength: descriptor.value.length,
            routeHandler: String(propertyKey),
        });
    };
}
