// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as yargs from 'yargs';

import { EnvironmentVariables } from '@system-inc/base-foundation/configuration/EnvironmentVariables';
import { PlatformType } from '@system-inc/base-foundation/configuration/Platform';
import { Wrangler } from '../cloudflare/Wrangler';
import { CliArguments } from '../common/CliHelpers';
import { CliEnvironmentVariables } from '../environment/CliEnvironmentVariables';
import { BaseWorkerProject } from '../project/BaseWorkerProject';
import { buildContainerDistIfPresent } from './ContainerCommand';
import { deployAllWorkers } from './deploy/DeployAllWorkers';
import {
    enforceCleanGitTree,
    reportUnreleasedMigrations,
    runWorkspaceChecks,
} from './deploy/DeployGates';
import { checkWorker, matchesDeployEnvironment } from './workspace/CheckWorker';

/**
 * Command for deploying a worker using wrangler.
 */
export class DeployCommand implements yargs.CommandModule {
    command = 'deploy [worker]';
    describe = 'Publishes the worker specified.';

    builder(args: yargs.Argv) {
        return args
            .positional('worker', {
                describe:
                    'Worker to deploy. Inferred from CWD if omitted. Use --all-workers to fan out.',
                type: 'string',
            })
            .option('platform', {
                describe: 'The platform to run the command for.',
                alias: 'p',
            })
            .option('all-workers', {
                describe:
                    'Deploy every worker in the workspace that targets the environment.',
                type: 'boolean',
            })
            .option('dry-run', {
                describe:
                    'Run the checks and print the workers that would deploy, without deploying. Only meaningful with --all-workers.',
                type: 'boolean',
            })
            .option('bundle', {
                describe:
                    'Bundle before deploying (default). Pass --no-bundle to skip wrangler build steps and directly deploy the script.',
                type: 'boolean',
                default: true,
            })
            .option('force', {
                describe: 'Force the deployment of the worker (skip checks)',
                type: 'boolean',
            })
            .option('allow-dirty', {
                describe:
                    'Allow deploying uncommitted changes to Production (recorded COMMIT_SHA is marked -dirty; other environments only warn)',
                type: 'boolean',
            })
            .option('skip-workspace-checks', {
                describe:
                    "Skip the workspace typecheck/lint/test gate (for CI pipelines that already ran the workspace's scripts)",
                type: 'boolean',
            })
            .conflicts('all-workers', 'worker')
            .demandOption('environment');
    }

    get handler(): (args: yargs.ArgumentsCamelCase) => void | Promise<void> {
        return async (args: yargs.Arguments) => {
            const [platform, environment] =
                CliArguments.getPlatformAndEnvironment(args);

            // --all-workers takes over: check, gate, and deploy every
            // worker. Handles its own per-worker logic.
            if (args.allWorkers === true) {
                await deployAllWorkers(args);
                return;
            }

            // Single-worker deploy path. Require a worker (either via
            // positional / -w / CWD inference handled by middleware).
            if (typeof args.worker !== 'string' || args.worker.length === 0) {
                console.error(
                    'No worker specified. Pass [worker], run from inside a worker folder, or pass --all-workers.',
                );
                process.exit(1);
            }

            // Refuse to ship uncommitted code to non-Development
            // environments — the recorded COMMIT_SHA must be honest.
            // Instant, so it runs before everything else.
            await enforceCleanGitTree(
                args,
                environment,
                args.workersFolder as string,
            );

            // Verify the worker's settings + wrangler config before deploying.
            if (!args.force) {
                // checkWorker runs the full validation suite and the
                // deployEnvironment gate; a `false` return means the worker is
                // gated out of this environment, so skip the deploy entirely.
                const shouldDeploy = await checkWorker(args, environment, true);
                if (!shouldDeploy) {
                    return;
                }
            } else {
                // --force bypasses the validation suite, but the
                // deployEnvironment gate still applies — a worker must never
                // deploy to an environment it doesn't target. Mirrors
                // --all-workers, which honors the gate regardless of --force.
                const settingsModule =
                    await BaseWorkerProject.create(args).loadSettingsModule(
                        environment,
                    );
                if (
                    !matchesDeployEnvironment(
                        settingsModule.settings.deployEnvironment,
                        environment,
                        args.worker,
                    )
                ) {
                    return;
                }
            }

            // get the platform and environment
            const project = BaseWorkerProject.create(args);

            // Refuse to deploy unreleased migrations to non-Development
            // environments. Source-of-truth is each database's
            // `release.ts` file. Bypass with --force.
            if (
                !args.force &&
                reportUnreleasedMigrations(project, environment)
            ) {
                process.exit(1);
            }

            // Last gate before publishing (slowest, so it runs after the
            // fast refusals): the workspace's own typecheck/lint/test
            // scripts. Deploy never ships a broken workspace.
            await runWorkspaceChecks(args, args.workersFolder as string);

            const [environmentVariables, wranglerEnvironmentVariables] =
                project.loadEnvironmentVariables(environment);

            await deployWorker(
                args,
                project,
                platform,
                environment,
                environmentVariables,
                wranglerEnvironmentVariables,
            );
        };
    }
}

export async function deployWorker(
    args: yargs.Arguments,
    project: BaseWorkerProject,
    platform: PlatformType,
    environment: string,
    environmentVariables: EnvironmentVariables,
    cliEnvironmentVariables: CliEnvironmentVariables,
) {
    await buildContainerDistIfPresent(project);

    if (platform === PlatformType.CloudflareWorker) {
        try {
            await Wrangler.deploy(
                args,
                project,
                environment,
                CliEnvironmentVariables.stringifyComplexVariables(
                    environmentVariables,
                ),
                cliEnvironmentVariables,
            );
        } catch (error) {
            process.exit(1);
        }
    } else {
        console.error(`Error during deploy: Unsupported platform ${platform}.`);
        process.exit(1);
    }
}
