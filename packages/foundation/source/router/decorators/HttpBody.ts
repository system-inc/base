// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { TypeFunc } from '@system-inc/base-common/type/TypeFunc';
import { routerMetadataAddParameter } from '../../internal/router/RouterMetadata';
import { HttpBodyMode } from '../../internal/router/RouterMetadataTypes';

export interface HttpBodyOptions {
    /**
     * How to parse the request body.
     *
     * - `json` (default): parses the body as JSON
     * - `stream`: provides the raw `ReadableStream` body
     * - `formData`: parses the body as multipart/form-data
     * - `text`: reads the body as a string
     * - `arrayBuffer`: reads the body as an ArrayBuffer
     * - `blob`: reads the body as a Blob
     */
    readonly mode?: HttpBodyMode;
}

/**
 * Injects the request body into a route handler parameter.
 *
 * Without arguments, the body is provided as a `ReadableStream`. This is
 * useful for file uploads and streaming use cases.
 *
 * With a {@link TypeFunc}, the body is parsed as JSON and deserialized
 * to the given type.
 *
 * With an {@link HttpBodyOptions} `mode`, the body is provided in the
 * specified format (stream, formData, text, arrayBuffer, or blob).
 *
 * @example
 * ```ts
 * // Raw stream (default for no arguments)
 * async upload(@HttpBody() body: ReadableStream) { ... }
 *
 * // Typed JSON
 * async create(@HttpBody(() => CreateInput) input: CreateInput) { ... }
 *
 * // Multipart form data
 * async webhook(@HttpBody({ mode: 'formData' }) form: FormData) { ... }
 *
 * // Plain text
 * async log(@HttpBody({ mode: 'text' }) body: string) { ... }
 * ```
 */
export function HttpBody(): ParameterDecorator;
export function HttpBody(type: TypeFunc): ParameterDecorator;
export function HttpBody(options: HttpBodyOptions): ParameterDecorator;
export function HttpBody(
    typeOrOptions?: TypeFunc | HttpBodyOptions,
): ParameterDecorator {
    return (
        target: object,
        propertyKey: string | symbol | undefined,
        parameterIndex: number,
    ) => {
        let typeFunc: TypeFunc | undefined;
        let options: { mode?: HttpBodyMode } | undefined;

        if (typeof typeOrOptions === 'function') {
            // TypeFunc — JSON mode with type
            typeFunc = typeOrOptions;
        } else if (typeOrOptions) {
            // HttpBodyOptions
            options = { mode: typeOrOptions.mode };
        } else {
            // No argument — default to stream
            options = { mode: 'stream' };
        }

        routerMetadataAddParameter(
            target.constructor as Constructor,
            String(propertyKey),
            {
                typeFunc,
                index: parameterIndex,
                metadataType: 'Body',
                options,
            },
        );
    };
}
