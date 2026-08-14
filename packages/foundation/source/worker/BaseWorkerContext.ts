// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseSettings } from '../base/BaseSettings';
import { BaseConfiguration } from '../configuration/BaseConfiguration';
import { EnvironmentVariables } from '../configuration/EnvironmentVariables';
import { BaseInjectionContainer } from '../dependency-injection/BaseInjectionContainer';

/**
 * Bundles a worker's {@link BaseConfiguration} (constructed from the
 * environment variables and settings) with its worker-scoped
 * dependency-injection container. Created by `BaseWorker` and registered in
 * the container so both are injectable.
 */
export class BaseWorkerContext {
    readonly configuration: BaseConfiguration;

    constructor(
        enivronmentVariables: EnvironmentVariables,
        settings: BaseSettings,
        readonly container: BaseInjectionContainer,
    ) {
        this.configuration = new BaseConfiguration(
            enivronmentVariables,
            settings,
        );
    }

    /**
     * Controls `JSON.stringify()` output.
     */
    toJSON() {
        return this.configuration.toJSON();
    }

    /**
     * Controls string coercion (template literals, `String()`, `"" + obj`).
     */
    toString(): string {
        return this.configuration.toString();
    }

    /**
     * Controls `console.log()` output in Node.js and Cloudflare Workers.
     */
    [Symbol.for('nodejs.util.inspect.custom')]() {
        return this.toJSON();
    }
}
