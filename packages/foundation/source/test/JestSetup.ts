// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import 'reflect-metadata';

import * as fs from 'fs';
import * as smolToml from 'smol-toml';

import { GenericTrap } from '@system-inc/base-common/type/UtilityTypes';
import { EnvironmentType } from '../configuration/Environment';
import {
    IntegrationTestEnvironment,
    IntegrationTestEnvironmentVariables,
    setIntegrationTestEnvironment,
} from './IntegrationTestEnvironment';

// Side-effect module: consumers add `import '@system-inc/base-foundation/test/JestSetup';`
// to their jest.setup.ts. This wires `reflect-metadata`, layers env vars from
// `<workersFolder>/test.env.toml` and the per-worker `test.env.toml` on top of
// `process.env`, resolves any `wrangler.toml` env-specific name override, and
// initializes the singleton `IntegrationTestEnvironment` so tests can call
// `IntegrationTestEnvironment.get()`.

const environment = process.env.ENVIRONMENT ?? EnvironmentType.Development;

let worker = process.env.TEST_WORKER_NAME;

let environmentVariables: GenericTrap<IntegrationTestEnvironmentVariables> = {
    ENVIRONMENT: environment.toString(),
    TEST_WORKER_NAME: worker,
    TEST_HOST: process.env.TEST_HOST,
};

environmentVariables = loadTestEnvFile(
    environment,
    environmentVariables,
    `${getWorkersFolder()}/test.env.toml`,
);

if (!worker && environmentVariables.TEST_WORKER_NAME) {
    worker = environmentVariables.TEST_WORKER_NAME;
}

if (worker) {
    environmentVariables = loadTestEnvFile(
        environment,
        environmentVariables,
        `${getWorkersFolder()}/${worker}/test.env.toml`,
    );
    const workerNameOverride = checkEnvironmentNameOverride(
        environment,
        `${getWorkersFolder()}/${worker}/wrangler.toml`,
    );
    if (workerNameOverride) {
        environmentVariables.TEST_WORKER_NAME = workerNameOverride;
    }
}

setIntegrationTestEnvironment(
    new IntegrationTestEnvironment(
        environmentVariables as IntegrationTestEnvironmentVariables,
    ),
);

function loadTestEnvFile(
    environment: string,
    environmentVariables: GenericTrap<
        Partial<IntegrationTestEnvironmentVariables>
    >,
    testEnvFile: string,
): GenericTrap<Partial<IntegrationTestEnvironmentVariables>> {
    if (!fs.existsSync(testEnvFile)) {
        return environmentVariables;
    }
    const content = fs.readFileSync(testEnvFile, 'utf8');
    const parsed = parseTomlOrExit(testEnvFile, content) as Record<
        string,
        Record<string, unknown>
    >;
    if (parsed?.[environment]) {
        environmentVariables = {
            ...environmentVariables,
            ...parsed[environment],
        };
    }
    return environmentVariables;
}

function checkEnvironmentNameOverride(
    environment: string,
    wranglerFile: string,
): string | undefined {
    if (!fs.existsSync(wranglerFile)) {
        return undefined;
    }
    const content = fs.readFileSync(wranglerFile, 'utf8');
    const parsed = parseTomlOrExit(wranglerFile, content) as {
        env?: Record<string, { name?: string }>;
    };
    return parsed?.env?.[environment]?.name;
}

function getWorkersFolder(): string {
    const workersFolder = process.env.WORKERS_FOLDER;
    if (workersFolder) {
        return workersFolder.endsWith('/')
            ? workersFolder.slice(0, -1)
            : workersFolder;
    }
    return '.';
}

function parseTomlOrExit(location: string, content: string): unknown {
    try {
        return smolToml.parse(content);
    } catch (error) {
        // Fatal pre-exit tooling output for the human running jest — must
        // never be filterable by a log level, so not the Logger.
        // eslint-disable-next-line no-console
        console.error('Unable to parse toml at:', location, 'Error:', error);
        process.exit(1);
    }
}
