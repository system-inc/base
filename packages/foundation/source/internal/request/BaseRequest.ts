// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { IRequestStrict } from 'itty-router';

import type { BaseRequestContext } from './BaseRequestContext';

export const BASE_REQUEST_BRAND = Symbol.for('BaseRequest');

/**
 * The BaseRequest interface represents the request object that is passed
 * to the route handlers.
 *
 * Framework-internal: the `context` field is typed as the concrete
 * {@link BaseRequestContext} so dispatchers can write to the framework-
 * owned fields (handler, route, cookies, etc.) as the request is resolved.
 * Application code sees the request context only via
 * `@InjectRequestContext()`, which types it as the read-only
 * `RequestContext` interface.
 */
export interface BaseRequest extends IRequestStrict {
    readonly [BASE_REQUEST_BRAND]: true;

    /**
     * The raw cookies from the request.
     */
    readonly cookies: Readonly<Record<string, string>>;

    /**
     * The framework request context for this request. Writable by
     * dispatchers, but surfaced to application code as the read-only
     * `RequestContext` interface via `@InjectRequestContext()`.
     */
    readonly context: BaseRequestContext;
}
