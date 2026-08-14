// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseConfiguration } from './BaseConfiguration';
import { BaseEnvironmentKeys } from './BaseEnivronmentKeys';
import { Environment } from './Environment';
import { ExecutionMode } from './ExecutionMode';
import { Platform } from './Platform';

/**
 * The Runtime class provides information about the current
 * runtime environment the worker is running on.
 * This includes the environment, execution mode, and platform.
 */
export class Runtime {
    /**
     * The environment of the worker.
     */
    readonly environment: Environment;

    /**
     * The execution mode of the worker.
     */
    readonly mode: ExecutionMode;

    /**
     * The platform the worker is running on.
     */
    readonly platform: Platform;

    constructor(configuration: BaseConfiguration) {
        this.environment = new Environment(
            configuration.getEnvironmentVariable(
                BaseEnvironmentKeys.Environment,
            ),
        );
        this.mode = new ExecutionMode(
            configuration.getEnvironmentVariable(
                BaseEnvironmentKeys.ExecutionMode,
            ),
        );
        this.platform = new Platform(
            configuration.getEnvironmentVariable(BaseEnvironmentKeys.Platform),
        );
    }

    toString(): string {
        return `Platform: ${this.platform.type}, Environment: ${this.environment.type}, ExecutionMode: ${this.mode.type}`;
    }
}
