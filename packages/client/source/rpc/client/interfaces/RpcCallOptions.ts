// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { JsonObject } from '@system-inc/base-common/json/Json';
import { Dictionary } from '@system-inc/base-common/type/Dictionary';

/**
 * Options for making a call to a remote procedure.
 */
export interface RpcCallOptions {
    /**
     * An optional identifier for the RPC call.
     */
    id?: string;

    /**
     * Optional metadata to attach to the RPC call.
     * This can be used to pass additional information to the server.
     */
    meta?: JsonObject;

    /**
     * Use a request as a template for the RPC call.
     * This will copy the headers from the request into the RPC call.
     */
    request?: Request;

    /**
     * Headers to include in the RPC call.
     */
    headers?: Dictionary<string>;

    /**
     * Cookies to include in the RPC call.
     */
    cookies?: Dictionary<string>;

    /**
     * Optionally specify an AbortSignal to cancel this RPC call.
     * This is used to abort the fetch request if needed.
     */
    signal?: AbortSignal;

    /**
     * Specifies the priority of the fetch request relative
     * to other requests of the same type.
     *
     * Default is 'auto'.
     */
    priority?: RequestPriority;

    /**
     * Whether to keep the connection alive for subsequent requests.
     */
    keepalive?: boolean;

    /**
     * Caching behavior for the fetch request.
     */
    cache?: RequestCache;

    /**
     * Retry configuration for the RPC call.
     */
    retry?: {
        /**
         * Maximum number of attempts (including the initial attempt).
         * Must be at least 1.
         * Default: 3
         */
        maxAttempts?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

        /**
         * Minimum backoff delay in milliseconds.
         * Default: 100
         */
        minBackoffMs?: number;

        /**
         * Maximum backoff delay in milliseconds.
         * Default: 2000 (2 seconds)
         */
        maxBackoffMs?: number;

        /**
         * Whether to apply jitter to the backoff delay.
         * Default: true
         */
        jitter?: boolean;

        /**
         * Custom function to determine if an error is retryable.
         * Default: Retries on network errors and 503 Service Unavailable
         */
        isRetryable?: (error: unknown) => boolean;
    };
}
