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
 * environment variable. Custom environment names are preserved as-is.
 *
 * `ENVIRONMENT` is required. There is deliberately no default: falling
 * back to Development would turn on dev-only behavior (GraphiQL, schema
 * introspection, migration-drift wipes) wherever a deploy forgot to set
 * it, and falling back to Production would hide the mistake. The `base`
 * CLI sets it for every command; deploys and runners outside the CLI must
 * set it themselves.
 */
export class Environment {
    readonly type: string;

    constructor(environment: string | undefined) {
        if (!environment || environment.trim().length === 0) {
            throw new Error(
                'ENVIRONMENT is not set. Base needs to know which environment ' +
                    "it's running in (e.g. Development, Production, Staging) and " +
                    'never guesses one. The `base` CLI sets it for you; when ' +
                    'deploying or running a worker any other way, set the ' +
                    'ENVIRONMENT variable explicitly.',
            );
        }
        switch (environment.toLowerCase()) {
            case EnvironmentType.Development.toLowerCase():
                this.type = EnvironmentType.Development;
                break;
            case EnvironmentType.Production.toLowerCase():
                this.type = EnvironmentType.Production;
                break;
            default:
                this.type = environment;
                break;
        }
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
