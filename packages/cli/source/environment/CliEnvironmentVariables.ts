// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { WranglerEnvironmentVariables } from './WranglerEnvironmentVariables';

export namespace CliEnvironmentVariables {
    export const Keys = [...WranglerEnvironmentVariables.Keys];

    export function stringifyComplexVariables(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        environmentVariables: Record<string, any>,
    ): Record<string, string> {
        const env: Record<string, string> = {};
        Object.keys(environmentVariables).forEach((key) => {
            const value = environmentVariables[key];
            if (typeof value === 'object' || Array.isArray(value)) {
                env[key] = JSON.stringify(value);
            } else {
                env[key] = value;
            }
        });
        return env;
    }
}

/**
 * Enivronment variables used by the command line interface only.
 * These variables should not be propagated to the worker environment.
 */
export interface CliEnvironmentVariables extends WranglerEnvironmentVariables {
    /**
     * Allows you to specify the workers folder to use if your worker is not in the default location.
     */
    WORKERS_FOLDER?: string;
}
