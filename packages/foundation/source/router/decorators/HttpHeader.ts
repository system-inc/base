// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { TypeFunc } from '@system-inc/base-common/type/TypeFunc';
import { routerMetadataAddParameter } from '../../internal/router/RouterMetadata';

/**
 * Injects a request header into a route handler parameter.
 *
 * With a name, injects that single header's value. With a {@link TypeFunc},
 * all request headers are serialized into the given type.
 *
 * @param nameOrType The name of the header, or the type to serialize all
 * headers into.
 * @param type The type to convert the named header to.
 * @example
 * ```ts
 * @HttpRoute('POST', '/webhooks/github')
 * async webhook(@HttpHeader('x-hub-signature') signature: string): Promise<Response> { ... }
 *
 * // All headers as one object
 * @HttpRoute('GET', '/debug')
 * async debug(@HttpHeader(() => TraceHeaders) headers: TraceHeaders): Promise<Response> { ... }
 * ```
 */
export function HttpHeader(
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
                metadataType: 'Headers',
            },
        );
    };
}
