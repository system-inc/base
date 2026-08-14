// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * The two environment names that carry framework semantics — the poles of
 * the environment spectrum, not an enumeration of all environments.
 * Names are free-form: a custom name (`Staging`, `Dogfood`, …) passes
 * through verbatim and is treated as a real, protected environment —
 * introspection off, migration gates enforced — without being listed
 * here. Deliberately closed: a new member would have no framework
 * behavior to attach to, so code that branches on a custom environment
 * compares `environment.type` instead.
 */
export enum EnvironmentType {
    Development = 'Development',
    Production = 'Production',
}

/**
 * The environment the worker is running in, parsed from the `ENVIRONMENT`
 * environment variable. Defaults to Development; custom environment names
 * are preserved as-is.
 */
export class Environment {
    readonly type: string;

    constructor(environment?: string) {
        let environmentType;
        if (environment) {
            switch (environment.toLowerCase()) {
                case EnvironmentType.Development.toLowerCase():
                    environmentType = EnvironmentType.Development;
                    break;
                case EnvironmentType.Production.toLowerCase():
                    environmentType = EnvironmentType.Production;
                    break;
                default:
                    environmentType = environment;
                    break;
            }
        }
        this.type = environmentType ?? EnvironmentType.Development;
    }

    /**
     * Check for a development environment.
     *
     * @returns true if the Worker is running in development, false otherwise.
     */
    get isDevelopment(): boolean {
        return this.type === EnvironmentType.Development;
    }

    /**
     * Check for a production environment.
     *
     * @returns true if the Worker is running in production, false otherwise.
     */
    get isProduction(): boolean {
        return this.type === EnvironmentType.Production;
    }
}
