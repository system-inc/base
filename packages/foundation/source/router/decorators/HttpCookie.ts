// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { TypeFunc } from '@system-inc/base-common/type/TypeFunc';
import { routerMetadataAddParameter } from '../../internal/router/RouterMetadata';

/**
 * Injects a cookie value into a route handler parameter.
 *
 * With a name, injects that single cookie's value — as a string, or converted
 * when a {@link TypeFunc} is also given. With only a {@link TypeFunc}, all
 * cookies are serialized into the given type.
 *
 * @param nameOrType The name of the cookie, or the type to serialize all
 * cookies into.
 * @param type The type to convert the named cookie to.
 * @example
 * ```ts
 * @HttpRoute('GET', '/me')
 * async me(@HttpCookie('sessionId') sessionId: string): Promise<Response> { ... }
 *
 * // All cookies as one object
 * @HttpRoute('GET', '/me')
 * async me(@HttpCookie(() => SessionCookies) cookies: SessionCookies): Promise<Response> { ... }
 * ```
 */
export function HttpCookie(
    nameOrType: string | TypeFunc,
    type?: TypeFunc,
): ParameterDecorator {
    return (
        target: object,
        propertyKey: string | symbol | undefined,
        parameterIndex: number,
    ) => {
        routerMetadataAddParameter(
            target.constructor as Constructor,
            String(propertyKey),
            {
                name: typeof nameOrType === 'string' ? nameOrType : undefined,
                typeFunc: typeof nameOrType === 'function' ? nameOrType : type,
                index: parameterIndex,
                metadataType: 'Cookies',
            },
        );
    };
}
