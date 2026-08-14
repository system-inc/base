// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { TypeFunc } from '@system-inc/base-common/type/TypeFunc';
import { routerMetadataAddParameter } from '../../internal/router/RouterMetadata';

export interface HttpQueryOptions {
    /**
     * Whether to URL decode the parameter value. Defaults to true.
     */
    decode?: boolean;
}

/**
 * Injects a query-string parameter into a route handler parameter.
 *
 * With a name, injects that single query parameter — as a string, or converted
 * when a {@link TypeFunc} is also given. With only a {@link TypeFunc}, all
 * query parameters are serialized into the given type. Values are URL-decoded
 * by default ({@link HttpQueryOptions}).
 *
 * @param nameOrType The name of the query parameter, or the type to serialize
 * all query parameters into.
 * @param typeOrOptions The type to convert the named parameter to, or options
 * for the parameter.
 * @param options Options for the parameter (only used when the second argument
 * is a type).
 * @example
 * ```ts
 * @HttpRoute('GET', '/search')
 * async search(
 *     @HttpQuery('term') term: string,
 *     @HttpQuery('limit', () => Number) limit: number,
 * ): Promise<Response> { ... }
 *
 * // All query parameters as one object
 * @HttpRoute('GET', '/search')
 * async search(@HttpQuery(() => SearchQuery) query: SearchQuery): Promise<Response> { ... }
 * ```
 */
export function HttpQuery(
    nameOrType: string | TypeFunc,
    typeOrOptions?: TypeFunc | HttpQueryOptions,
    options?: HttpQueryOptions,
): ParameterDecorator {
    return (
        target: object,
        propertyKey: string | symbol | undefined,
        parameterIndex: number,
    ) => {
        // Determine the actual type and options based on what was passed
        let type: TypeFunc | undefined;
        let actualOptions: HttpQueryOptions | undefined;

        if (typeof typeOrOptions === 'function') {
            // Second parameter is a type function
            type = typeOrOptions;
            actualOptions = options;
        } else {
            // Second parameter is options (or undefined)
            type = undefined;
            actualOptions = typeOrOptions;
        }

        routerMetadataAddParameter(
            target.constructor as Constructor,
            String(propertyKey),
            {
                name: typeof nameOrType === 'string' ? nameOrType : undefined,
                typeFunc: typeof nameOrType === 'function' ? nameOrType : type,
                index: parameterIndex,
                metadataType: 'Query',
                options: actualOptions,
            },
        );
    };
}
