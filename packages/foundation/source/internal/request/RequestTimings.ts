// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * The timings used by Base to measure the time it takes to perform
 * various operations.
 */
export namespace RequestTimings {
    /**
     * The time it takes Base to initialize itself.
     */
    export const Init = 'init';

    /**
     * The time it takes to initialize the request after
     * Base has been initialized, but before the middleware is run.
     */
    export const RequestInit = 'request-init';

    /**
     * The time it takes the request to be processed by the middleware.
     */
    export const Middleware = 'middleware';

    /**
     * The time it takes the request to be processed by the handler.
     */
    export const Handler = 'handler';

    /**
     * The time it takes the response to be created after the handler has run.
     */
    export const ResponseInit = 'response-init';
}
