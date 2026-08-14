// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Supported HTTP methods.
 */
export enum HttpMethod {
    GET = 'GET',
    HEAD = 'HEAD',
    POST = 'POST',
    PUT = 'PUT',
    DELETE = 'DELETE',
    OPTIONS = 'OPTIONS',
    PATCH = 'PATCH',
    ALL = 'ALL',
}

/**
 * Type for HttpMethod.
 */
export type HttpMethodType = `${HttpMethod}`;
