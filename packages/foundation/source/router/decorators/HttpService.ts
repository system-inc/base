// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { DecoratorRegistry } from '@system-inc/base-common/decorator/DecoratorRegistry';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { routerMetadataAddService } from '../../internal/router/RouterMetadata';

export const HttpServiceDecoratorName = 'HttpService';

/**
 * Marks a class as an HTTP service — the entry point for the `@HttpRoute`
 * handlers defined within it.
 *
 * List the class in a module's (or the worker's) `services`; its routes are
 * bound at boot, and a fresh instance is resolved from the request-scoped
 * container for each incoming request.
 *
 * @example
 * ```ts
 * @HttpService()
 * export class AccountService {
 *     @HttpRoute('GET', '/accounts/:id')
 *     async get(@HttpPath('id') id: string): Promise<Response> {
 *         return Response.json({ id });
 *     }
 * }
 * ```
 */
export function HttpService(): ClassDecorator {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    return (target: Function) => {
        const ctor = target as Constructor<object>;
        DecoratorRegistry.get().mark(ctor, HttpServiceDecoratorName);
        routerMetadataAddService(ctor);
    };
}
