// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { getGlobalVariable } from '@system-inc/base-common/global/Global';
import { EventBusMetadata } from '../internal/metadata/EventBusMetadata';
import { GqlMetadata } from '../internal/metadata/GqlMetadata';
import { MiddlewareMetadata } from '../internal/metadata/MiddlewareMetadata';
import { ScheduledMetadata } from '../internal/metadata/ScheduledMetadata';
import { ValidationMetadata } from '../internal/metadata/ValidationMetadata';
import { WorkerQueueMetadata } from '../internal/metadata/WorkerQueueMetadata';

/**
 * Object for holding the framework's own cross-cutting metadata
 * registries — the ones decorators write into and the dispatchers read.
 *
 * Modules do NOT register metadata here: a module's bespoke metadata is
 * just import-time singleton state, owned by the module as a
 * module-scope singleton in its own file (the same pattern as
 * `DecoratorRegistry`). The framework assumes ONE copy of the code per
 * process — `DecoratorRegistry`'s static instance already depends on
 * it — so a central registry would buy no extra safety, while its
 * `globalThis` lifetime would outlive jest's per-file module registry
 * and dev-server reloads that reset everything else.
 */
export class BaseMetadata {
    /**
     * Metadata for GraphQL.
     */
    readonly graphql = new GqlMetadata();

    /**
     * Metadata for sceduled executations.
     */
    readonly scheduled = new ScheduledMetadata();

    /**
     * Metadata for queues.
     */
    readonly queue = new WorkerQueueMetadata();

    /**
     * Metadata for middleware.
     */
    readonly middleware = new MiddlewareMetadata();

    /**
     * Metadata for the event bus.
     */
    readonly eventBus = new EventBusMetadata();

    /**
     * Metadata for validation rules attached to classes via the
     * `@Verify*` decorators. Consumed by `ValidationEngine.validate()`.
     */
    readonly validation = new ValidationMetadata();
}

/**
 * Gets the global base metadata object.
 *
 * @returns
 */
export function getBaseMetadata(): BaseMetadata {
    const globalVariable = getGlobalVariable();

    if (!globalVariable.BaseMetadata) {
        globalVariable.BaseMetadata = new BaseMetadata();
    }

    return globalVariable.BaseMetadata;
}
