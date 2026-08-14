// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseEvent } from './BaseEvent';

/**
 * The well-known name of the event the framework defers whenever a
 * handler throws an exception the application did not model — register
 * an `@EventBusListener(UnhandledExceptionEventName)` to observe them
 * (persist to a database, notify, etc.).
 */
export const UnhandledExceptionEventName = 'Base.UnhandledException';

/**
 * The dispatch surface an unhandled exception escaped from.
 */
export type UnhandledExceptionSurface =
    | 'http'
    | 'rpc'
    | 'graphql'
    | 'queue'
    | 'scheduled'
    | 'websocket';

/**
 * Deferred by the framework when a handler throws an unexpected
 * exception — one that was not an intentional, client-facing error
 * (`HttpError`, validation failure), i.e. exactly the errors the
 * framework masks from clients.
 *
 * Emission rides the deferred-action chain: listeners run after the
 * response is sent (via `waitUntil` on the request path) and resolve
 * from the event's own scoped container, so a listener can inject
 * repositories or services. Listener failures are logged and never
 * cascade.
 *
 * On surfaces with platform retry semantics (queue, scheduled) the
 * event fires on every failed attempt — deduplication is the
 * listener's concern.
 *
 * ```ts
 * @EventBusListener(UnhandledExceptionEventName)
 * export class ErrorPersister
 *     implements BaseEventListener<UnhandledExceptionEvent>
 * {
 *     async onEvent(event: UnhandledExceptionEvent) {
 *         // log to the database, page someone, ...
 *     }
 * }
 * ```
 */
export interface UnhandledExceptionEvent extends BaseEvent {
    name: typeof UnhandledExceptionEventName;

    /**
     * The thrown value, unmasked. May be anything `throw` allows.
     */
    error: unknown;

    /**
     * The dispatch surface the exception escaped from.
     */
    surface: UnhandledExceptionSurface;

    /**
     * The request id, when the surface has one (http, rpc, graphql).
     */
    requestId?: string;

    /**
     * The caller's IP address, when the surface has a request (http,
     * rpc, graphql) — so a listener can tell a customer hitting a bug
     * from a crawler probing endpoints. The framework stores nothing;
     * whether to persist caller identity is the listener's choice.
     */
    ipAddress?: string;

    /**
     * The caller's User-Agent header, when the surface has a request.
     * Same persistence note as `ipAddress`.
     */
    userAgent?: string;

    /**
     * What was executing: the route, RPC procedure, GraphQL operation,
     * queue message type, or scheduled executable name.
     */
    detail: string;
}
