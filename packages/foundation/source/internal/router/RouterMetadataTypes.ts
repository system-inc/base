// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { HttpMethodType } from '@system-inc/base-common/http/HttpMethod';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { TypeFunc } from '@system-inc/base-common/type/TypeFunc';

/**
 * Metadata for defining an HTTP route handler.
 */
export interface HttpServiceMetadata {
    readonly service: Constructor<object>;
}

/**
 * Metadata for defining a route.
 */
export interface HttpRouteMetadata {
    readonly path: string;
    readonly method: HttpMethodType | HttpMethodType[];
    readonly parameterLength: number;
    readonly routeHandler: string;
}

export type HttpParameterMetadata =
    | HeadersMetadata
    | CookiesMetadata
    | PathMetadata
    | QueryMetadata
    | RequestBodyMetadata;

/**
 * Base class for all route parameter metadata.
 */
interface BaseParameterMetadata {
    readonly name?: string;
    readonly typeFunc?: TypeFunc;
    readonly index: number;
}

/**
 * Metadata for getting a route parameter from the request headers.
 */
export interface HeadersMetadata extends BaseParameterMetadata {
    readonly metadataType: 'Headers';
}

/**
 * Metadata for getting a route parameter from the request cookies.
 */
export interface CookiesMetadata extends BaseParameterMetadata {
    readonly metadataType: 'Cookies';
}

/**
 * Metadata for getting a route parameter from the request path.
 */
export interface PathMetadata extends BaseParameterMetadata {
    readonly metadataType: 'Path';
    readonly options?: {
        decode?: boolean;
    };
}

/**
 * Metadata for getting a route parameter from the request query parameters.
 */
export interface QueryMetadata extends BaseParameterMetadata {
    readonly metadataType: 'Query';
    readonly options?: {
        decode?: boolean;
    };
}

/**
 * How to parse the request body.
 * - `json` (default when a type is provided): parses the body as JSON and deserializes to the typed object
 * - `stream`: provides the raw `ReadableStream` body
 * - `formData`: parses the body as multipart/form-data
 * - `text`: reads the body as a string
 * - `arrayBuffer`: reads the body as an ArrayBuffer
 * - `blob`: reads the body as a Blob
 */
export type HttpBodyMode =
    | 'json'
    | 'stream'
    | 'formData'
    | 'text'
    | 'arrayBuffer'
    | 'blob';

/**
 * Metadata for getting a route parameter from the request body.
 */
export interface RequestBodyMetadata extends BaseParameterMetadata {
    readonly metadataType: 'Body';
    readonly options?: {
        readonly mode?: HttpBodyMode;
    };
}
