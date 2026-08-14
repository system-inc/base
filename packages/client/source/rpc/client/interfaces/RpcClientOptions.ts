// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Dictionary } from '@system-inc/base-common/type/Dictionary';
import { RpcClientIdGenerator } from './RpcClientIdGenerator';

export interface RpcClientOptions {
    /**
     * Additional headers to be sent with each request.
     */
    headers?: Dictionary<string>;

    /**
     * Cookies to be sent with each request.
     */
    cookies?: Dictionary<string>;

    /**
     * Controls whether or not the browser sends credentials with the request,
     * as well as whether any Set-Cookie response headers are respected.
     * Credentials are cookies, TLS client certificates, or authentication
     * headers containing a username and password.
     */
    credentials?: RequestCredentials;

    /**
     * Whether to keep the connection alive for subsequent requests.
     */
    keepalive?: boolean;

    /**
     * Sets cross-origin behavior for the request.
     */
    mode?: RequestMode;

    /**
     * Specifies the priority of the fetch request relative
     * to other requests of the same type.
     *
     * Default is 'auto'.
     */
    priority?: RequestPriority;

    /**
     * A function to generate unique IDs for RPC calls.
     * @returns
     */
    idGenerator?: RpcClientIdGenerator;

    /**
     * Default caching behavior for the fetch request.
     */
    cache?: RequestCache;
}
