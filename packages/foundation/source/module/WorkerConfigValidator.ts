// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { BaseSettings } from '../base/BaseSettings';
import type { EnvironmentVariables } from '../configuration/EnvironmentVariables';

/**
 * A reference to a platform binding (R2 bucket, queue producer, KV
 * namespace, service binding, etc.) by its binding name.
 */
export interface WorkerBindingReference {
    readonly binding: string;
}

/**
 * Platform-agnostic view of the bindings declared for the worker in
 * its deployment configuration (e.g. Cloudflare's wrangler.toml).
 *
 * CLI tooling adapts the raw platform configuration into this shape
 * before handing it to module-contributed validators.
 */
export interface WorkerBindings {
    readonly r2Buckets: readonly WorkerBindingReference[];
    readonly queues: readonly WorkerBindingReference[];
    readonly kv: readonly WorkerBindingReference[];
    readonly services: readonly WorkerBindingReference[];
    readonly d1Databases: readonly WorkerBindingReference[];
}

/**
 * Context passed to a {@link WorkerConfigValidator}.
 *
 * Contains everything a module needs to assert that its deployment
 * configuration matches its runtime requirements.
 */
export interface WorkerConfigValidationContext {
    readonly environment: string;
    readonly workerName: string;
    readonly settings: BaseSettings;
    readonly environmentVariables: EnvironmentVariables;
    readonly bindings: WorkerBindings;
}

/**
 * A function contributed by a module that validates the worker's
 * deployment configuration against the module's runtime requirements.
 *
 * Throw a {@link WorkerConfigValidationError} (or any `Error`) to
 * signal a failure; the CLI will surface the message and exit.
 */
export type WorkerConfigValidator = (
    context: WorkerConfigValidationContext,
) => void | Promise<void>;

/**
 * Thrown by a {@link WorkerConfigValidator} to signal that the
 * deployment configuration is missing something the module requires.
 */
export class WorkerConfigValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'WorkerConfigValidationError';
    }
}
