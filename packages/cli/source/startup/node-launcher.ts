// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

// This file is spawned as its own `node` process (see DevelopCommand.runNode).
// The TS runtime (ts-node + tsconfig-paths + raw-file extensions) must register
// before any `@system-inc/base-*` import below, so the framework source in
// node_modules and the consumer worker's .ts entry all transpile through one
// ts-node instance — exactly as base-cli.ts does. Keep these two side-effect
// imports first; the @system-inc imports that follow rely on them being live.
// The TS runtime is skipped when the launcher targets a prebuilt .js worker
// bundle (the container bootstrap context, where typescript is not installed).
import './preload';
import './RegisterTsRuntimeIfTsEntry';

import { DefaultConfigurationKey } from '@system-inc/base-common/configuration/NamedConfiguration';
import { EnvironmentType } from '@system-inc/base-foundation/configuration/Environment';
import { EnvironmentVariables } from '@system-inc/base-foundation/configuration/EnvironmentVariables';
import { ExecutionModeType } from '@system-inc/base-foundation/configuration/ExecutionMode';
import { PlatformType } from '@system-inc/base-foundation/configuration/Platform';
import { BaseWorker } from '@system-inc/base-foundation/worker/BaseWorker';
import { BaseWorkerNodeRunner } from '@system-inc/base-foundation/worker/node/BaseWorkerNodeRunner';
import { BaseWorkerProject } from '../project/BaseWorkerProject';

runWorker().catch((error: unknown) => {
    console.error('Failed to start worker:', error);
    process.exit(1);
});

async function runWorker() {
    // get the worker index file from the process arguments
    const workerIndexPath = process.argv.pop();
    const workerFolder = process.argv.pop();
    const workerName = process.argv.pop();
    if (!workerIndexPath) {
        console.error('No worker delegate path found in process args.');
        process.exit(1);
    }
    console.log('Running worker at: ', workerIndexPath);

    // load the worker entrypoint
    const workerEntrypointModule = await import(workerIndexPath);
    const baseWorker = unwindModule(workerEntrypointModule) as BaseWorker;
    const baseWorkerProject = BaseWorkerProject.create({
        worker: workerName,
        workersFolder: workerFolder,
        $0: process.argv[0],
        _: process.argv.slice(1),
    });

    // get the environment type from the process.env
    const environmentType =
        process.env.ENVIRONMENT ?? EnvironmentType.Development;
    const executionMode = process.env.EXECUTION_MODE
        ? ExecutionModeType.fromString(process.env.EXECUTION_MODE)
        : ExecutionModeType.Local;
    const runConfigName =
        typeof process.env.RUN_CONFIG === 'string'
            ? process.env.RUN_CONFIG
            : DefaultConfigurationKey;

    // load the environment variables for the worker
    const [environmentVariables, _wranglerEnvironmentVariables] =
        baseWorkerProject.loadEnvironmentVariables(environmentType, {
            EXECUTION_MODE: executionMode,
            RUN_CONFIG: runConfigName,
        } satisfies EnvironmentVariables);

    // create and start the NodeWorker
    const nodeRunner = new BaseWorkerNodeRunner(baseWorker);
    await nodeRunner.start({
        ...environmentVariables,
        PLATFORM: PlatformType.Node,
    });
}

// some modules are wrapped in a default property,
// we need to unwind till we get to the actual module
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwindModule(module: any) {
    if (module.default) {
        return unwindModule(module.default);
    }
    return module;
}
