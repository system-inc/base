// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as yargs from 'yargs';

import { CliArguments } from '../common/CliHelpers';
import { checkInstalledDependencies } from './workspace/CheckInstalledDependencies';
import { checkWorker } from './workspace/CheckWorker';
import {
    reportSharedDatabaseOwnershipViolations,
    SharedDatabaseOwnershipCollector,
} from './workspace/SharedDatabaseOwnership';
import { getWorkspaceWorkers } from './workspace/WorkspaceCommand';

/**
 * `base check [worker]` — validates the framework-specific bits of a
 * worker (settings.ts, wrangler.toml, ORM bindings, schema-up-to-date,
 * durable-sqlite validators where applicable).
 *
 * Single worker by default (CWD-inferred or `[worker]` positional);
 * `--all-workers` fans out across every worker in the workspace.
 *
 * Build, lint, and test belong to `npm run build / lint / test`. The
 * `npm run ci` script chains them with `base check --all-workers`.
 */
export class CheckCommand implements yargs.CommandModule {
    command = 'check [worker]';
    describe =
        'Validates worker config (settings.ts, wrangler.toml, ORM bindings). Single worker by default; --all-workers to fan out.';

    builder(args: yargs.Argv) {
        return args
            .positional('worker', {
                describe: 'Worker to check. Inferred from CWD if omitted.',
                type: 'string',
            })
            .option('all-workers', {
                describe: 'Check every worker in the workspace instead of one.',
                type: 'boolean',
            })
            .conflicts('worker', 'all-workers');
    }

    async handler(args: yargs.Arguments) {
        const [_platform, environment] =
            CliArguments.getPlatformAndEnvironment(args);

        // Stale install otherwise surfaces as cryptic settings.ts load errors.
        checkInstalledDependencies(process.cwd());

        if (args.allWorkers === true) {
            const workers = getWorkspaceWorkers(args);
            if (workers.length === 0) {
                console.log('No workers found in workspace.');
                return;
            }
            console.log(
                `Checking ${workers.length} worker(s) for environment '${environment}'...`,
            );
            const sharedDatabaseOwnership =
                new SharedDatabaseOwnershipCollector();
            for (const worker of workers) {
                await checkWorker(
                    { ...args, worker },
                    environment,
                    false,
                    sharedDatabaseOwnership,
                );
                console.log();
            }
            // Cross-worker: a table on a shared database must have exactly
            // one owner — two owners means two migration histories writing
            // DDL for the same table.
            if (
                reportSharedDatabaseOwnershipViolations(sharedDatabaseOwnership)
            ) {
                process.exit(1);
            }
            console.log('✅ All workers passed.');
            return;
        }

        if (typeof args.worker !== 'string' || args.worker.length === 0) {
            console.error(
                'No worker specified. Pass `[worker]`, run from inside a worker folder, or pass --all-workers.',
            );
            process.exit(1);
        }

        await checkWorker(args, environment);
    }
}
