// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { TypeFunc } from '@system-inc/base-common/type/TypeFunc';
import { routerMetadataAddParameter } from '../../internal/router/RouterMetadata';

export interface HttpPathOptions {
    /**
     * Whether to URL decode the parameter value. Defaults to true.
     */
    decode?: boolean;
}

/**
 * Injects a path parameter into a route handler parameter.
 *
 * With a name, injects that single `:name` segment of the route path — as a
 * string, or converted when a {@link TypeFunc} is also given. With only a
 * {@link TypeFunc}, all path parameters are serialized into the given type.
 * Values are URL-decoded by default ({@link HttpPathOptions}).
 *
 * @param nameOrType The name of the path parameter, or the type to serialize
 * all path parameters into.
 * @param typeOrOptions The type to convert the named parameter to, or options
 * for the parameter.
 * @param options Options for the parameter (only used when the second argument
 * is a type).
 * @example
 * ```ts
 * @HttpRoute('GET', '/accounts/:id')
 * async get(@HttpPath('id') id: string): Promise<Response> { ... }
 *
 * // Typed conversion
 * @HttpRoute('GET', '/orders/:index')
 * async order(@HttpPath('index', () => Number) index: number): Promise<Response> { ... }
 *
 * // All path parameters as one object
 * @HttpRoute('GET', '/repos/:owner/:name')
 * async repo(@HttpPath(() => RepoPath) path: RepoPath): Promise<Response> { ... }
 * ```
 */
export function HttpPath(
    nameOrType: string | TypeFunc,
    typeOrOptions?: TypeFunc | HttpPathOptions,
    options?: HttpPathOptions,
): ParameterDecorator {
    return (
        target: object,
        propertyKey: string | symbol | undefined,
        parameterIndex: number,
    ) => {
        // Determine the actual type and options based on what was passed
        let type: TypeFunc | undefined;
        let actualOptions: HttpPathOptions | undefined;

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
                metadataType: 'Path',
                options: actualOptions,
            },
        );
    };
}
