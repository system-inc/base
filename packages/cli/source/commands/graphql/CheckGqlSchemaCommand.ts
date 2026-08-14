// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as yargs from 'yargs';

import { BaseProvider } from '../../common/BaseProvider';
import { resetBaseGlobalState } from '../../project/BaseWorkerProject';
import { getWorkspaceWorkers } from '../workspace/WorkspaceCommand';
import {
    GqlSchemaCheckResult,
    performGqlSchemaCheck,
    printGqlSchemaCheckResult,
} from './GqlSchemaCheck';

/**
 * `base graphql schema:check [worker]` — verify the worker's current
 * GraphQL schema is backward-compatible with the committed baseline
 * (`<worker>/graphql/schemas/schema.graphql`).
 *
 * Uses graphql-js's `findBreakingChanges` and `findDangerousChanges`.
 * Exits non-zero on breaking changes unless `--allow-breaking`.
 * `--strict` treats dangerous as breaking. `--all-workers` fans out
 * across the workspace and skips workers with no GraphQL configured.
 *
 * Same per-worker drift check also runs as part of `base check` —
 * this command exists for explicit per-worker runs and CI fan-outs.
 */
export class CheckGqlSchemaCommand implements yargs.CommandModule {
    command = 'schema:check [worker]';
    describe =
        'Verify the GraphQL schema is backward-compatible with the committed baseline. Fails on breaking changes (removed fields, type changes, required new args, etc.).';

    builder(args: yargs.Argv) {
        return args
            .positional('worker', {
                describe: 'Worker to operate on. Inferred from CWD if omitted.',
                type: 'string',
            })
            .option('all-workers', {
                describe:
                    'Check every worker in the workspace; workers without GraphQL are skipped with a message.',
                type: 'boolean',
            })
            .option('allow-breaking', {
                describe:
                    'Report breaking changes but exit 0 anyway. Use only when the breakage is intentional and the front end is being migrated in lockstep.',
                type: 'boolean',
            })
            .option('strict', {
                describe:
                    'Treat dangerous changes (e.g. new enum values, new union members) as breaking.',
                type: 'boolean',
            })
            .conflicts('all-workers', 'worker');
    }

    get handler(): (args: yargs.ArgumentsCamelCase) => void | Promise<void> {
        return async (args: yargs.Arguments) => {
            if (args.allWorkers === true) {
                await checkAllWorkersGqlSchemas(args);
                return;
            }

            if (typeof args.worker !== 'string' || args.worker.length === 0) {
                console.error(
                    'No worker specified. Pass [worker], run from inside a worker folder, or pass --all-workers.',
                );
                process.exit(1);
            }

            const baseProvider = new BaseProvider(args);
            const base = await baseProvider.getBase();
            await base.initialize();

            // Specific commands error on misconfiguration (user typo'd
            // worker, ran the wrong command, etc.).
            if (!base.configuration.graphql) {
                console.error(
                    `❌ Worker '${baseProvider.project.worker}' has no GraphQL configuration. There's nothing to check.`,
                );
                process.exit(1);
            }

            const result = await performGqlSchemaCheck(
                base,
                baseProvider.project,
            );
            printGqlSchemaCheckResult(result);
            if (shouldExitNonZero(result, args)) {
                process.exit(1);
            }
        };
    }
}

async function checkAllWorkersGqlSchemas(args: yargs.Arguments): Promise<void> {
    const workers = getWorkspaceWorkers(args);
    let failingCount = 0;
    let skippedCount = 0;

    for (const worker of workers) {
        const baseProvider = new BaseProvider({ ...args, worker });
        const base = await baseProvider.getBase();
        await base.initialize();

        // Aggregate path: silently skip workers without GraphQL.
        if (!base.configuration.graphql) {
            console.log(
                `(skipped) Worker '${worker}' has no GraphQL configuration.`,
            );
            skippedCount++;
            resetBaseGlobalState();
            console.log();
            continue;
        }

        const result = await performGqlSchemaCheck(base, baseProvider.project);
        printGqlSchemaCheckResult(result);
        if (shouldExitNonZero(result, args)) {
            failingCount++;
        }

        // Decorator metadata accumulates across iterations — reset so
        // the next worker's settings.ts load doesn't trip duplicate
        // registrations from the previous one.
        resetBaseGlobalState();
        console.log();
    }

    if (failingCount > 0 && args.allowBreaking !== true) {
        console.error(
            `❌ ${failingCount} worker(s) have GraphQL schema problems.`,
        );
        process.exit(1);
    }
    console.log(
        `✅ GraphQL schema check passed for ${workers.length - skippedCount} worker(s) (${skippedCount} skipped).`,
    );
}

function shouldExitNonZero(
    result: GqlSchemaCheckResult,
    args: yargs.Arguments,
): boolean {
    if (result.state === 'missing-baseline') return true;
    if (result.state === 'breaking') return args.allowBreaking !== true;
    if (result.state === 'dangerous-only' && args.strict === true) {
        return args.allowBreaking !== true;
    }
    return false;
}
