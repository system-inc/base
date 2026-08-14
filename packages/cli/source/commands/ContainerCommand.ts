// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as yargs from 'yargs';

import { resolveNodeLauncherPath } from '../common/ResolveNodeLauncherPath';
import { resolveProjectTsconfig } from '../common/ResolveProjectTsconfig';
import { Run } from '../common/Run';
import { BaseWorkerProject } from '../project/BaseWorkerProject';

/**
 * Command for managing container workers.
 *
 * Usage:
 *   node base container bundle -w <worker-name>
 *   node base container dist -w <worker-name>
 */
export class ContainerCommand implements yargs.CommandModule {
    command = 'container <command>';
    describe = 'Build and bundle container workers.';

    get builder(): yargs.CommandBuilder | undefined {
        return (args: yargs.Argv) => {
            return args
                .command(new ContainerBundleCommand())
                .command(new ContainerDistCommand())
                .demandCommand();
        };
    }

    async handler(_args: yargs.Arguments) {
        throw new Error('Method not implemented.');
    }
}

/**
 * Bundles the container worker script using esbuild.
 */
async function bundleContainerWorker(
    workerProject: BaseWorkerProject,
): Promise<void> {
    const containerName = await workerProject.loadContainerName();
    const outFile = `${workerProject.containerDistFolder}/${containerName}.js`;

    const esBuildArgs = [
        workerProject.containerIndexFile,
        '--bundle',
        '--platform=node',
        `--outfile=${outFile}`,
        ...workerProject.containerExternals.map((ext) => `--external:${ext}`),
    ];

    // Base ships decorator-based .ts source into node_modules; esbuild only
    // applies experimentalDecorators to those files when given an explicit
    // tsconfig. Mirror the regular worker bundle path.
    const projectTsconfig = resolveProjectTsconfig();
    if (projectTsconfig) {
        esBuildArgs.push(`--tsconfig=${projectTsconfig}`);
    }

    console.log(`Bundling container worker: ${containerName}`);
    await Run.program('./node_modules/.bin/esbuild', esBuildArgs);
}

/**
 * Bundles the bootstrap (node-launcher) script using esbuild.
 */
async function bundleBootstrap(
    workerProject: BaseWorkerProject,
): Promise<void> {
    const outFile = `${workerProject.containerDistFolder}/bootstrap.js`;

    const esBuildArgs = [
        resolveNodeLauncherPath(),
        '--bundle',
        '--platform=node',
        `--outfile=${outFile}`,
    ];

    console.log('Bundling bootstrap.js');
    await Run.program('./node_modules/.bin/esbuild', esBuildArgs);
}

/**
 * Bundles the container worker and bootstrap if a base worker container
 * is present. Silently skips if no container worker is found.
 * Used by develop, deploy, and bundle commands.
 */
export async function buildContainerDistIfPresent(
    workerProject: BaseWorkerProject,
): Promise<void> {
    if (!workerProject.hasContainerWorker) {
        return;
    }
    console.log(
        `Container worker detected for ${workerProject.worker}, bundling...`,
    );
    workerProject.cleanContainerDist();
    await bundleContainerWorker(workerProject);
    await bundleBootstrap(workerProject);
}

/**
 * Bundles the container worker entry point.
 *
 * Usage: node base container bundle -w <worker-name>
 */
class ContainerBundleCommand implements yargs.CommandModule {
    command = 'bundle [worker]';
    describe = 'Bundle the container worker script using esbuild.';

    builder(args: yargs.Argv) {
        return args.positional('worker', {
            describe: 'Worker to bundle. Inferred from CWD if omitted.',
            type: 'string',
        });
    }

    get handler(): (args: yargs.ArgumentsCamelCase) => void | Promise<void> {
        return async (args: yargs.Arguments) => {
            const workerProject = BaseWorkerProject.create(args);
            if (!workerProject.hasContainerWorker) {
                console.error(
                    `No container worker found for '${workerProject.worker}'. Expected index.ts and settings.ts in: ${workerProject.containerFolder}`,
                );
                process.exit(1);
            }
            await bundleContainerWorker(workerProject);
        };
    }
}

/**
 * Bundles both the container worker and bootstrap into the dist folder.
 *
 * Usage: node base container dist -w <worker-name>
 */
class ContainerDistCommand implements yargs.CommandModule {
    command = 'dist [worker]';
    describe =
        'Bundle the container worker and bootstrap into the dist folder.';

    builder(args: yargs.Argv) {
        return args.positional('worker', {
            describe: 'Worker to package. Inferred from CWD if omitted.',
            type: 'string',
        });
    }

    get handler(): (args: yargs.ArgumentsCamelCase) => void | Promise<void> {
        return async (args: yargs.Arguments) => {
            const workerProject = BaseWorkerProject.create(args);
            if (!workerProject.hasContainerWorker) {
                console.error(
                    `No container worker found for '${workerProject.worker}'. Expected index.ts and settings.ts in: ${workerProject.containerFolder}`,
                );
                process.exit(1);
            }
            await bundleContainerWorker(workerProject);
            await bundleBootstrap(workerProject);
        };
    }
}
