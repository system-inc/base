// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as yargs from 'yargs';

import { DefaultConfigurationKey } from '@system-inc/base-common/configuration/NamedConfiguration';
import { EnvironmentVariables } from '@system-inc/base-foundation/configuration/EnvironmentVariables';
import { ExecutionModeType } from '@system-inc/base-foundation/configuration/ExecutionMode';
import { PlatformType } from '@system-inc/base-foundation/configuration/Platform';
import { Wrangler } from '../cloudflare/Wrangler';
import { CliArguments, CliPlatformType } from '../common/CliHelpers';
import { resolveNodeLauncherPath } from '../common/ResolveNodeLauncherPath';
import { Run } from '../common/Run';
import { CliEnvironmentVariables } from '../environment/CliEnvironmentVariables';
import { BaseWorkerProject } from '../project/BaseWorkerProject';
import { buildContainerDistIfPresent } from './ContainerCommand';

/**
 * Command for starting the development server using wrangler.
 */
export class DevelopCommand implements yargs.CommandModule {
    command = 'develop [worker]';
    describe = 'Starts the development server.';

    builder(args: yargs.Argv) {
        return args
            .positional('worker', {
                describe: 'Worker to develop. Inferred from CWD if omitted.',
                type: 'string',
            })
            .option('platform', {
                alias: 'p',
                describe: 'The platform to run the command for.',
                type: 'string',
            })
            .option('remote', {
                describe:
                    "Develop against remote resources and data stored on Cloudflare's network.",
                type: 'string',
            })
            .option('bundle', {
                describe:
                    'Bundle before running (default). Pass --no-bundle to skip wrangler build steps and directly run the script.',
                type: 'boolean',
                default: true,
            })
            .option('test-scheduled', {
                describe: 'Test scheduled workers',
                type: 'string',
            })
            .option('run-config', {
                alias: 'c',
                type: 'string',
                describe: 'Specify a custom named configuration to run.',
            })
            .option('persist-to', {
                type: 'string',
                describe:
                    "Directory for wrangler's local state (D1/KV/R2/DO). Overrides the workspace package.json `base.persistTo`; workers pointed at the same root share local databases.",
            })
            .demandOption('worker');
    }

    get handler(): (args: yargs.ArgumentsCamelCase) => void | Promise<void> {
        return async (args: yargs.Arguments) => {
            // get the platform and environment
            // eslint-disable-next-line prefer-const
            let [platform, environment] =
                CliArguments.getPlatformAndEnvironment(args);

            // get the settings for the worker
            const baseWorkerProject = BaseWorkerProject.create(args);
            const settingsModule =
                await baseWorkerProject.loadSettingsModule(environment);
            const runConfigName =
                typeof args.runConfig === 'string'
                    ? args.runConfig
                    : DefaultConfigurationKey;

            // set any universal worker settings
            const serverSettings =
                settingsModule.settings.server?.[runConfigName];
            if (!serverSettings && runConfigName !== DefaultConfigurationKey) {
                console.warn(
                    `Warning: No server settings found for run configuration '${runConfigName}'.`,
                );
            }
            if (serverSettings?.port) {
                args.port = serverSettings.port;
            }
            if (serverSettings?.inspectorPort) {
                args['inspector-port'] = serverSettings.inspectorPort;
            }

            // load the environment variables for the worker
            const [environmentVariables, wranglerEnvironmentVariables] =
                baseWorkerProject.loadEnvironmentVariables(environment);

            // resolve the effective platform: CLI args < server settings <
            // PLATFORM env var (lets a worker that only runs on one platform
            // pin it). Shared with `bundle` via CliPlatformType.resolvePlatform.
            platform = CliPlatformType.resolvePlatform(
                platform,
                serverSettings,
                environmentVariables,
            );

            // automatically bundle container assets if present
            await buildContainerDistIfPresent(baseWorkerProject);

            // run the command using the proper toolchain for the platform
            if (platform === PlatformType.CloudflareWorker) {
                if (serverSettings) {
                    if (serverSettings.protocol === 'https') {
                        args['local-protocol'] = 'https';
                        args['https-key-path'] = serverSettings.keyPath;
                        args['https-cert-path'] =
                            serverSettings.certificatePath;
                    }
                    if (serverSettings.host) {
                        args.ip = serverSettings.host;
                    }
                }
                try {
                    await Wrangler.dev(
                        args,
                        baseWorkerProject,
                        environment,
                        CliEnvironmentVariables.stringifyComplexVariables(
                            environmentVariables,
                        ),
                        wranglerEnvironmentVariables,
                    );
                } catch (error) {
                    console.error('Error during develop:', error);
                    process.exit(1);
                }
            } else if (platform === PlatformType.Node) {
                try {
                    await this.runNode(
                        baseWorkerProject,
                        environment,
                        runConfigName,
                    );
                } catch (error) {
                    console.error('Error during develop:', error);
                    process.exit(1);
                }
            } else {
                console.error(
                    `Error during develop: Unsupported platform ${platform}.`,
                );
                process.exit(1);
            }
        };
    }

    private async runNode(
        worker: BaseWorkerProject,
        environment: string,
        runConfig: string,
    ): Promise<void> {
        console.log('Running development server for Node.js');
        // The launcher self-registers ts-node so the dynamic `import()` of the
        // worker's `.ts` entry resolves at runtime.
        const launcherPath = resolveNodeLauncherPath();
        await Run.program(
            'node',
            [
                launcherPath,
                worker.worker,
                worker.relativeWorkersFolder,
                worker.indexFile,
            ],
            {
                env: {
                    ...process.env,
                    PLATFORM: PlatformType.Node,
                    ENVIRONMENT: environment,
                    EXECUTION_MODE: ExecutionModeType.Local,
                    RUN_CONFIG: runConfig,
                    // Worker-specific environment variables (env.toml,
                    // wrangler.toml [env.*.vars]) are loaded by the
                    // launcher itself via `BaseWorkerProject.loadEnvironmentVariables`.
                } satisfies EnvironmentVariables,
            },
        );
    }
}
