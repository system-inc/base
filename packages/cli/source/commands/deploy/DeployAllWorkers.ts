// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as yargs from 'yargs';

import { PlatformType } from '@system-inc/base-foundation/configuration/Platform';
import { CliArguments } from '../../common/CliHelpers';
import { BaseWorkerProject } from '../../project/BaseWorkerProject';
import { WranglerToml } from '../../project/WranglerToml';
import { deployWorker } from '../DeployCommand';
import { checkWorker } from '../workspace/CheckWorker';
import {
    reportSharedDatabaseOwnershipViolations,
    SharedDatabaseOwnershipCollector,
} from '../workspace/SharedDatabaseOwnership';
import { getWorkspaceWorkers } from '../workspace/WorkspaceCommand';
import {
    enforceCleanGitTree,
    reportUnreleasedMigrations,
    runWorkspaceChecks,
} from './DeployGates';
import { DeployOrderNode, orderByDependencies } from './DeployOrder';

/**
 * Implements `base deploy --all-workers`: runs every worker's checks and
 * the workspace gates, then deploys each worker that targets the
 * environment, binding targets before the workers that bind them.
 * Every worker in the list deploys — there is deliberately
 * no "unchanged, skip" path, because a bytes-vs-live comparison cannot
 * see wrangler.toml or container-image changes and would silently strand
 * them; wrangler publishes are idempotent, so always deploying is safe.
 */
export async function deployAllWorkers(args: yargs.Arguments): Promise<void> {
    const [platform, environment] =
        CliArguments.getPlatformAndEnvironment(args);
    if (platform !== PlatformType.CloudflareWorker) {
        console.error(`Error: Unsupported platform ${platform}`);
        process.exit(1);
    }

    console.log(`Deploying workspace using ${environment} environment ...`);

    // Refuse to ship uncommitted code to non-Development environments —
    // the recorded COMMIT_SHA must be honest. Instant, so it runs first.
    await enforceCleanGitTree(args, environment, args.workersFolder as string);

    // Per-worker config validation across all workers before deploying any.
    const workerFolders = getWorkspaceWorkers(args);
    console.log();

    const deployList: string[] = [];
    const sharedDatabaseOwnership = new SharedDatabaseOwnershipCollector();
    for (const workerFile of workerFolders) {
        const workerArgs = { ...args, worker: workerFile };
        const shouldDeploy = await checkWorker(
            workerArgs,
            environment,
            false,
            sharedDatabaseOwnership,
        );
        console.log();
        if (shouldDeploy) {
            deployList.push(workerFile);
        }
    }

    // Cross-worker: refuse to deploy while a shared database's table has
    // two owners — two migration histories writing DDL for one table.
    if (reportSharedDatabaseOwnershipViolations(sharedDatabaseOwnership)) {
        process.exit(1);
    }

    // Unreleased-migration gate for every worker that would deploy —
    // covered here (not only in the single-worker path) because CI
    // deploys through --all-workers. All violations surface in one run
    // before any worker deploys. Bypass: --force / Development.
    if (args.force !== true) {
        let migrationsBlocked = false;
        for (const workerFile of deployList) {
            const project = BaseWorkerProject.create({
                ...args,
                worker: workerFile,
            });
            if (reportUnreleasedMigrations(project, environment)) {
                migrationsBlocked = true;
            }
        }
        if (migrationsBlocked) {
            process.exit(1);
        }
    }

    // Deploy binding targets before their binders: Cloudflare rejects a
    // service or Durable Object binding whose target script does not
    // exist yet, so on a fresh account an unordered first workspace
    // deploy fails partway. Independent workers keep discovery order.
    const { ordered: deployOrder, cyclic } = orderByDependencies(
        collectDeployOrderNodes(args, deployList, environment),
    );
    if (cyclic.length > 0) {
        console.warn(
            `Warning: circular bindings involving: ${cyclic.join(', ')}. ` +
                'No deploy order can satisfy a cycle on a fresh account — if the first ' +
                'deploy of a cycle member fails, deploy the rest and rerun.',
        );
    }

    if (args.dryRun) {
        if (deployOrder.length > 0) {
            console.log(
                `The following workers would be deployed: ${deployOrder.join(', ')}`,
            );
        } else {
            console.log('No workers require deployment.');
        }
        console.log('Dry run complete. Exiting without deployment.');
        return;
    }

    if (deployOrder.length === 0) {
        console.log('No workers require deployment. Exiting.');
        return;
    }

    // Last gate before publishing (slowest, so it runs after the fast
    // refusals and the no-op short-circuits): the workspace's own
    // typecheck/lint/test scripts, once for the whole workspace.
    await runWorkspaceChecks(args, args.workersFolder as string);

    for (const workerFile of deployOrder) {
        const workerArgs = { ...args, worker: workerFile };
        const project = BaseWorkerProject.create(workerArgs);
        const [environmentVariables, cliEnvironmentVariables] =
            project.loadEnvironmentVariables(environment);

        console.log(`[${project.worker}]: Deploying worker...`);
        await deployWorker(
            workerArgs,
            project,
            platform,
            environment,
            environmentVariables,
            cliEnvironmentVariables,
        );
        console.log(`[${project.worker}]: Deployed successfully.`);
        console.log();
    }
    console.log('Workspace deployed successfully.');
}

/**
 * Reads each worker's binding edges for the target environment out of
 * its wrangler.toml: `services[].service` and Durable Object
 * `bindings[].script_name` name the deployed scripts this worker needs
 * to exist before it can deploy.
 */
function collectDeployOrderNodes(
    args: yargs.Arguments,
    workerFolders: ReadonlyArray<string>,
    environment: string,
): DeployOrderNode[] {
    return workerFolders.map((workerFile) => {
        const project = BaseWorkerProject.create({
            ...args,
            worker: workerFile,
        });
        const wranglerEnvironment =
            WranglerToml.parse(project).env[environment];
        const dependencies = [
            ...(wranglerEnvironment?.services ?? []).map(
                (service) => service.service,
            ),
            ...(wranglerEnvironment?.durable_objects?.bindings ?? [])
                .map((binding) => binding.script_name)
                .filter((name): name is string => typeof name === 'string'),
        ];
        return {
            folder: workerFile,
            deployedName: wranglerEnvironment?.name,
            dependencies,
        };
    });
}
