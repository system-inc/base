// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Environment } from '../configuration/Environment';
import {
    DatabaseEnvironmentVariables,
    EnvironmentVariables,
} from '../configuration/EnvironmentVariables';
import {
    ExecutionMode,
    ExecutionModeType,
} from '../configuration/ExecutionMode';
import { Platform } from '../configuration/Platform';
import { IntegrationTestClient } from './IntegrationTestClient';

/**
 * Interface for all common environment variables used in integration tests.
 */
export interface IntegrationTestEnvironmentVariables extends EnvironmentVariables {
    /**
     * The host to use for running integration tests.
     * If set this will always be used and the TEST_HOST_SUFFIX will be ignored.
     */
    TEST_HOST?: string;

    /**
     * This is the name of the worker to run tests for.
     *
     * This variable is only used when running tests from VSCode
     * and is normally provided via the command line -w flag.
     *
     * This is used solely for loading additional
     * worker specific test environment variables.
     */
    TEST_WORKER_NAME?: string;

    /**
     * The suffix to use for computing the test host.
     * This will be combined with the worker name to form the test host.
     * An an example, if the worker name is 'worker' and the suffix is 'test.workers.dev',
     * then the test host will be 'worker.test.workers.dev'.
     */
    TEST_HOST_SUFFIX?: string;
}

let _integrationTestEnvironment: IntegrationTestEnvironment | undefined =
    undefined;

/**
 * To be used ONLY by jest.setup.ts to set the integration test environment.
 *
 * @param integrationTestEnvironment
 */
export function setIntegrationTestEnvironment(
    integrationTestEnvironment: IntegrationTestEnvironment,
) {
    if (_integrationTestEnvironment) {
        throw new Error('IntegrationTestEnvironment already initialized');
    }
    _integrationTestEnvironment = integrationTestEnvironment;
}

/**
 * Environment to facilitate integration testing.
 */
export class IntegrationTestEnvironment {
    static get(): IntegrationTestEnvironment {
        if (!_integrationTestEnvironment) {
            throw new Error('IntegrationTestEnvironment not initialized');
        }
        return _integrationTestEnvironment;
    }

    readonly environment: Environment;
    readonly mode: ExecutionMode;
    readonly platform: Platform;
    private readonly _environmentVariables: IntegrationTestEnvironmentVariables;

    constructor(environmentVariables: IntegrationTestEnvironmentVariables) {
        this._environmentVariables = environmentVariables;
        this.environment = new Environment(environmentVariables.ENVIRONMENT);
        this.mode = new ExecutionMode(ExecutionModeType.Test);
        this.platform = new Platform(environmentVariables.PLATFORM);
    }

    getEnvironmentVariables<T>(): IntegrationTestEnvironmentVariables & T {
        return this
            ._environmentVariables as IntegrationTestEnvironmentVariables & T;
    }

    get host(): string {
        // Tooling output for the human running the tests: which host the
        // suite resolved is the first thing to check when integration
        // config goes wrong, so it must always print — not the Logger.
        if (process.env.TEST_HOST) {
            // eslint-disable-next-line no-console
            console.log('Using TEST_HOST:', process.env.TEST_HOST);
            return process.env.TEST_HOST;
        } else if (this._environmentVariables.TEST_HOST) {
            // eslint-disable-next-line no-console
            console.log(
                'Using TEST_HOST:',
                this._environmentVariables.TEST_HOST,
            );
            return this._environmentVariables.TEST_HOST;
        } else if (
            this._environmentVariables.TEST_WORKER_NAME &&
            this._environmentVariables.TEST_HOST_SUFFIX
        ) {
            const testHost = `${this._environmentVariables.TEST_WORKER_NAME}.${this._environmentVariables.TEST_HOST_SUFFIX}`;
            // eslint-disable-next-line no-console
            console.log(
                'Using TEST_WORKER_NAME and TEST_HOST_SUFFIX:',
                testHost,
            );
            return testHost;
        }
        throw new Error(
            'TEST_HOST or TEST_WORKER_NAME and TEST_HOST_SUFFIX must be set',
        );
    }

    get worker(): string | undefined {
        return this._environmentVariables.TEST_WORKER_NAME;
    }

    getDatabaseUrl(name: string): string | undefined {
        const databases = this._environmentVariables.DATABASES;
        if (!Array.isArray(databases)) {
            return undefined;
        }
        const database = (databases as DatabaseEnvironmentVariables[]).find(
            (db) => db.name === name,
        );
        return database?.url;
    }

    get testEnvironmentVariables(): IntegrationTestEnvironmentVariables {
        return this._environmentVariables;
    }

    private _integrationTestClient: IntegrationTestClient | undefined;
    get client(): IntegrationTestClient {
        if (!this._integrationTestClient) {
            this._integrationTestClient = new IntegrationTestClient(this);
        }
        return this._integrationTestClient;
    }
}
