// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { DependencyContainer } from 'tsyringe';

/**
 * The scope of the dependency container.
 *
 * - `@global` — the global scope container. Should only be used for
 *   stateless (static) registrations. Examples: providers, configuration.
 * - `@worker` — the worker scope container, for worker-specific
 *   registrations. Examples: durable objects, scheduled jobs.
 * - `@request` — the request scope container, for request-specific
 *   registrations. Examples: resolvers, context, rpc, http, user account.
 * - `@scheduled` — the scheduled scope container, for scheduled-specific
 *   registrations; similar to the request scope.
 * - `@queue` — the queue scope container, for queue-specific registrations;
 *   similar to the request scope.
 * - `@websocket` — the websocket scope container, for websocket-specific
 *   registrations; similar to the request scope.
 */
export type BaseInjectionContainerScope =
    | '@global'
    | '@worker'
    | '@request'
    | '@scheduled'
    | '@queue'
    | '@websocket';

/**
 * Dependency injection container for Base.
 */
export interface BaseInjectionContainer extends DependencyContainer {
    readonly scope: BaseInjectionContainerScope;
}
