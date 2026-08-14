// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as yargs from 'yargs';

import { CliArguments } from '../../common/CliHelpers';
import { ormCheckDrizzleSchema } from '../../orm/drizzle/OrmGetDrizzleBoilerplate';
import {
    BaseWorkerProject,
    resetBaseGlobalState,
} from '../../project/BaseWorkerProject';
import { getWorkspaceWorkers } from '../workspace/WorkspaceCommand';
import { ormGetDatabaseName } from './OrmCommand';

/**
 * `base orm schema:check [worker]` — verifies the committed `schema.generated.ts`
 * matches what the entities would produce right now. Cheap, read-only,
 * and ideal as a CI guard: catches the common mistake of editing an
 * entity and forgetting to run `schema:generate`.
 *
 * Single-worker (`[worker]` or `-w <name>`): checks one database
 * (`--database` or default). Exits non-zero with a diff hint when out
 * of sync.
 *
 * `--all-workers`: fans out across the workspace. Workers without ORM
 * are skipped. Per worker, every drizzle database is checked.
 *
 * The actual comparison lives in `ormCheckDrizzleSchema` so the
 * `workspace check` per-worker validation can call the same code.
 */
export class OrmSchemaCheckCommand implements yargs.CommandModule {
    command = 'schema:check [worker]';
    describe =
        'Check schema.generated.ts is up to date with your entities — read-only; fails if schema:generate would change it';

    builder(args: yargs.Argv) {
        return args
            .positional('worker', {
                describe: 'Worker to operate on. Inferred from CWD if omitted.',
                type: 'string',
            })
            .option('all-workers', {
                describe:
                    'Check every worker in the workspace; workers without ORM are skipped with a message. Checks every drizzle database in each worker.',
                type: 'boolean',
            })
            .conflicts('all-workers', 'worker')
            .conflicts('all-workers', 'database');
    }

    get handler(): (args: yargs.ArgumentsCamelCase) => void | Promise<void> {
        return async (args: yargs.Arguments) => {
            if (args.allWorkers === true) {
                await checkAllWorkersOrmSchemas(args);
                return;
            }

            const databaseName = ormGetDatabaseName(args);
            const [_platform, environment] =
                CliArguments.getPlatformAndEnvironment(args);
            const workerProject = BaseWorkerProject.create(args);
            const settingsModule =
                await workerProject.loadSettingsModule(environment);

            const result = ormCheckDrizzleSchema(
                workerProject,
                databaseName,
                settingsModule.settings,
            );
            if (result.upToDate) {
                console.log(
                    result.reason === 'no-owned-tables'
                        ? `✅ '${databaseName}' has no owned tables (all entities external) — nothing to check.`
                        : `✅ schema.generated.ts is up-to-date for database '${databaseName}'.`,
                );
                return;
            }

            if (result.reason === 'missing-file') {
                console.error(
                    `❌ schema.generated.ts is missing at ${result.schemaPath}.`,
                );
            } else {
                console.error(
                    `❌ schema.generated.ts is out of sync with entities for database '${databaseName}'.`,
                );
                console.error(`   File: ${result.schemaPath}`);
            }
            console.error(
                `   Run \`base orm schema:generate --worker ${workerProject.worker} --database ${databaseName}\` to regenerate it.`,
            );
            process.exit(1);
        };
    }
}

/**
 * Aggregate path: fans out over every worker in the workspace, skipping
 * workers without ORM and checking every drizzle database per worker.
 * Mirrors the structure of `checkAllWorkersGqlSchemas` so the
 * aggregate/specific distinction stays consistent across the CLI.
 */
async function checkAllWorkersOrmSchemas(args: yargs.Arguments): Promise<void> {
    const workers = getWorkspaceWorkers(args);
    const [_platform, environment] =
        CliArguments.getPlatformAndEnvironment(args);

    let failingCount = 0;
    let skippedCount = 0;
    let checkedDatabaseCount = 0;

    for (const worker of workers) {
        const project = BaseWorkerProject.create({ ...args, worker });
        const settingsModule = await project.loadSettingsModule(environment);
        const orm = settingsModule.settings.orm;

        const drizzleDatabases = orm
            ? Object.entries(orm).filter(
                  ([, config]) => config?.adapterType === 'drizzle',
              )
            : [];

        if (drizzleDatabases.length === 0) {
            console.log(
                `(skipped) Worker '${worker}' has no drizzle ORM databases.`,
            );
            skippedCount++;
            resetBaseGlobalState();
            console.log();
            continue;
        }

        let workerFailed = false;
        for (const [databaseName] of drizzleDatabases) {
            const result = ormCheckDrizzleSchema(
                project,
                databaseName,
                settingsModule.settings,
            );
            checkedDatabaseCount++;
            if (result.upToDate) {
                console.log(
                    result.reason === 'no-owned-tables'
                        ? `[${worker}]: ✅ '${databaseName}' has no owned tables (all entities external) — nothing to check.`
                        : `[${worker}]: ✅ schema.generated.ts is up-to-date for '${databaseName}'.`,
                );
                continue;
            }
            workerFailed = true;
            if (result.reason === 'missing-file') {
                console.error(
                    `[${worker}]: ❌ schema.generated.ts is missing at ${result.schemaPath}.`,
                );
            } else {
                console.error(
                    `[${worker}]: ❌ schema.generated.ts is out of sync with entities for database '${databaseName}'.`,
                );
                console.error(`   File: ${result.schemaPath}`);
            }
            console.error(
                `   Run \`base orm schema:generate --worker ${worker} --database ${databaseName}\` to regenerate it.`,
            );
        }

        if (workerFailed) failingCount++;
        resetBaseGlobalState();
        console.log();
    }

    if (failingCount > 0) {
        console.error(`❌ ${failingCount} worker(s) have ORM schema problems.`);
        process.exit(1);
    }
    console.log(
        `✅ ORM schema check passed for ${checkedDatabaseCount} database(s) across ${workers.length - skippedCount} worker(s) (${skippedCount} skipped).`,
    );
}
