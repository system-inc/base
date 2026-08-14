// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'node:fs';
import * as nodePath from 'node:path';
import * as yargs from 'yargs';

import { EnvironmentType } from '@system-inc/base-foundation/configuration/Environment';
import { IntegrationTestEnvironmentVariables } from '@system-inc/base-foundation/test/IntegrationTestEnvironment';
import { CliArguments, userCwd } from '../common/CliHelpers';
import { Run } from '../common/Run';
import { discoverModuleIntegrationTests } from '../modules/ModuleTestDiscovery';
import {
    BaseWorkerProject,
    resetBaseGlobalState,
} from '../project/BaseWorkerProject';
import { getWorkspaceWorkers } from './workspace/WorkspaceCommand';

/**
 * `base test [worker]` — runs the worker's integration tests.
 *
 * Unit tests are pure jest — run them with `npm test` (or `npx jest`).
 * `base test` exists for integration runs because those need
 * framework-aware setup: `TEST_WORKER_NAME`, `TEST_HOST` resolution
 * from settings.ts, `test.env.toml` layering, per-worker module-test
 * discovery, and the multi-worker iteration that `--all-workers` does.
 *
 * The split mirrors the boundary established for the CLI: standard dev
 * tools (build, lint, unit tests) come from `npm`; framework things
 * (worker config, integration, scaffolding) come from `base`.
 */
export class TestCommand implements yargs.CommandModule {
    command = 'test [worker]';
    describe =
        "Run a worker's integration tests. Unit tests belong to `npm test` / `npx jest`.";

    builder(args: yargs.Argv) {
        return args
            .positional('worker', {
                describe:
                    'Worker to test. Inferred from CWD if omitted. Use --all-workers to fan out.',
                type: 'string',
            })
            .option('all-workers', {
                description:
                    "Loop every worker in the workspace, running each worker's integration tests with the right per-worker env (TEST_WORKER_NAME, TEST_HOST).",
                type: 'boolean',
            })
            .option('test-host', {
                description:
                    "Override the integration test target host. Defaults to the worker's `settings.server['@default']` (host:port).",
                type: 'string',
            })
            .option('test-name-pattern', {
                alias: 't',
                description:
                    "Filter tests by name (regex). Forwarded to jest's --testNamePattern.",
                type: 'string',
            })
            .option('test-path-pattern', {
                description:
                    "Filter tests by file path (regex). Forwarded to jest's --testPathPattern, e.g. --test-path-pattern AccessControl runs only matching files.",
                type: 'string',
            })
            .option('test-timeout', {
                describe:
                    'Per-test timeout in ms, forwarded to jest --testTimeout. Defaults to 60000.',
                type: 'number',
            })
            .conflicts('all-workers', 'worker');
    }

    get handler(): (args: yargs.ArgumentsCamelCase) => void | Promise<void> {
        return async (args: yargs.Arguments) => {
            const [_platform, environment] =
                CliArguments.getPlatformAndEnvironment(args);

            if (args.allWorkers === true) {
                await runAllWorkersIntegrationTests(args, environment);
                return;
            }

            if (typeof args.worker !== 'string' || args.worker.length === 0) {
                console.error(
                    'No worker specified. Pass [worker], run from inside a worker folder, or pass --all-workers.',
                );
                process.exit(1);
            }

            await runWorkerIntegrationTests(args, environment);
        };
    }
}

/**
 * Loops every worker in the workspace and runs that worker's
 * integration tests with the right per-worker env. Resets module-level
 * base state between workers so each suite gets a clean slate.
 * Container-based workers run last so their containers get more boot
 * time before being hit.
 */
async function runAllWorkersIntegrationTests(
    args: yargs.Arguments,
    environment: string,
): Promise<void> {
    const workers = getWorkspaceWorkers(args);
    workers.sort((a, b) => {
        const aHasContainer = BaseWorkerProject.create({
            ...args,
            worker: a,
        }).hasContainerWorker;
        const bHasContainer = BaseWorkerProject.create({
            ...args,
            worker: b,
        }).hasContainerWorker;
        if (aHasContainer === bHasContainer) return 0;
        return aHasContainer ? 1 : -1;
    });

    for (const worker of workers) {
        console.log(`Running integration tests for worker: ${worker}`);
        await runWorkerIntegrationTests({ ...args, worker }, environment, [
            '--passWithNoTests',
        ]);
        resetBaseGlobalState();
    }
}

async function runWorkerIntegrationTests(
    args: yargs.Arguments,
    environment: string,
    extraJestArgs: string[] = [],
): Promise<void> {
    const workerName = args.worker as string;

    const baseTestEnvironment: Pick<
        IntegrationTestEnvironmentVariables,
        'ENVIRONMENT' | 'TEST_WORKER_NAME' | 'TEST_HOST'
    > = {
        ENVIRONMENT: environment,
        TEST_WORKER_NAME: workerName,
    };

    if (environment === EnvironmentType.Production) {
        console.error(
            'Integration tests should not be run against a production environment.',
        );
        process.exit(1);
    }

    console.log(`Running integration tests for worker: ${workerName}`);

    const project = BaseWorkerProject.create(args);
    const settingsModule = await project.loadSettingsModule(environment);

    // Scope the run to the worker folder's integration tests, plus any
    // integration tests contributed by modules the worker uses
    // (foundation modules that ship their own *.integration.test.ts).
    const match: string[] = [
        `${project.workerFolder}/**/*.integration.test.ts`,
    ];
    const moduleTestSetting = settingsModule.settings.moduleTest;
    if (moduleTestSetting) {
        const explicitNames = Array.isArray(moduleTestSetting)
            ? moduleTestSetting
            : undefined;
        const mainModuleNames =
            explicitNames ??
            (settingsModule.settings.modules ?? []).map((m) => m.name);
        match.push(
            ...discoverModuleIntegrationTests(
                project.settingsFile,
                mainModuleNames,
            ),
        );
        if (project.hasContainerWorker) {
            match.push(
                ...discoverModuleIntegrationTests(
                    project.containerSettingsFile,
                    explicitNames,
                ),
            );
        }
    }

    // TEST_HOST precedence (highest wins):
    //   1. --test-host arg                  per-invocation override
    //   2. process.env.TEST_HOST            explicit env injection
    //   3. settings.server[<environment>]   per-env override (e.g. Integration)
    //   4. settings.server['@default']      local-dev fallback
    //
    // Each `server[*]` entry is treated as a complete block — no
    // field-level fallback between env and @default. Otherwise an
    // Integration entry that sets only `host` would silently inherit
    // `port: 3001` from the dev config and produce `host:3001`, which
    // breaks deployed-worker URLs (no port, just https).
    const serverCfg =
        settingsModule.settings.server?.[environment] ??
        settingsModule.settings.server?.['@default'];

    if (typeof args.testHost === 'string') {
        baseTestEnvironment.TEST_HOST = args.testHost;
    } else if (process.env.TEST_HOST) {
        baseTestEnvironment.TEST_HOST = process.env.TEST_HOST;
    } else if (serverCfg?.host) {
        baseTestEnvironment.TEST_HOST = serverCfg.port
            ? `${serverCfg.host}:${serverCfg.port}`
            : serverCfg.host;
        const sourceKey = settingsModule.settings.server?.[environment]
            ? environment
            : '@default';
        console.log(
            `Derived TEST_HOST from settings.server[${sourceKey}]: ${baseTestEnvironment.TEST_HOST}`,
        );
    }

    if (typeof args.workersFolder === 'string') {
        process.env.WORKERS_FOLDER = args.workersFolder;
    }

    const jestArgs: string[] = [
        '--runInBand',
        `--testTimeout=${args.testTimeout ?? 60000}`,
        ...extraJestArgs,
    ];
    if (typeof args.testNamePattern === 'string') {
        jestArgs.push('--testNamePattern', args.testNamePattern);
    }
    if (typeof args.testPathPattern === 'string') {
        jestArgs.push('--testPathPattern', args.testPathPattern);
    }
    const jestConfigPath = findJestConfig(userCwd());
    if (jestConfigPath) {
        jestArgs.push('--config', jestConfigPath);
    }
    // Explicit testMatch overrides whatever testPathIgnorePatterns the
    // consumer's jest.config.js sets to hide integration files from
    // `npm test`. Without this our integration glob would still be
    // filtered out.
    jestArgs.push(
        '--testPathIgnorePatterns',
        '/node_modules/',
        '--testMatch',
        ...match,
    );

    try {
        await Run.program(resolveJestBin(), jestArgs, {
            env: {
                ...process.env,
                ...baseTestEnvironment,
            },
            // Anchor jest at the user's CWD so it walks up to find
            // `jest.config.js` correctly (npx mangles CWD).
            cwd: userCwd(),
        });
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

/**
 * Walk up from `startDir` looking for the nearest jest config file. Returns
 * the absolute path if found, undefined otherwise (in which case we leave
 * jest to its own discovery logic).
 */
export function findJestConfig(startDir: string): string | undefined {
    const names = [
        'jest.config.ts',
        'jest.config.js',
        'jest.config.mjs',
        'jest.config.cjs',
    ];
    let dir = startDir;
    while (true) {
        for (const name of names) {
            const candidate = nodePath.join(dir, name);
            if (fs.existsSync(candidate)) return candidate;
        }
        const parent = nodePath.dirname(dir);
        if (parent === dir) return undefined;
        dir = parent;
    }
}

function resolveJestBin(): string {
    try {
        const packageJsonPath = require.resolve('jest/package.json');
        return nodePath.join(nodePath.dirname(packageJsonPath), 'bin/jest.js');
    } catch (error) {
        throw new Error(
            `Could not resolve 'jest': ${(error as Error).message}. Install it: \`npm install --save-dev jest ts-jest @types/jest\``,
        );
    }
}
