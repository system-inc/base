// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as yargs from 'yargs';

import { CliArguments } from '../../common/CliHelpers';
import { ormGetDatabaseTableNames } from '../../orm/drizzle/OrmGetDatabaseTableNames';
import { BaseWorkerProject } from '../../project/BaseWorkerProject';
import { ormGetDatabaseName } from './OrmCommand';
import { getOrmAdapterType } from './OrmCommandHelper';
import { ormRunDrizzleCommand } from './OrmRunDrizzleCommand';

/**
 * Command for pushing schema changes directly to the database.
 * Maps to: schema:sync
 */
export class OrmSchemaSyncCommand implements yargs.CommandModule {
    command = 'schema:sync [worker]';
    describe =
        'Apply your entity schema directly to the database, skipping migrations — dev shortcut, scoped to this worker’s tables. Writes to the DB';

    get builder(): yargs.CommandBuilder | undefined {
        return (args: yargs.Argv) => {
            return args
                .positional('worker', {
                    describe:
                        'Worker to operate on. Inferred from CWD if omitted.',
                    type: 'string',
                })
                .option('force', {
                    describe: 'Skip confirmation prompts',
                    type: 'boolean',
                })
                .option('strict', {
                    describe: 'Always ask for confirmation',
                    type: 'boolean',
                })
                .option('verbose', {
                    describe: 'Show verbose output',
                    type: 'boolean',
                })
                .option('all-tables', {
                    describe:
                        "Reconcile ALL tables in the database, not just this worker's. " +
                        "By default sync is scoped (via --tablesFilter) to this worker's " +
                        'entities so it never touches unrelated tables in a shared database. ' +
                        'Pass this to lift that scope — destructive: tables this worker ' +
                        "doesn't define can be dropped. Use only on a database you fully own.",
                    type: 'boolean',
                });
        };
    }

    get handler(): (args: yargs.ArgumentsCamelCase) => void | Promise<void> {
        return async (args: yargs.Arguments) => {
            const databaseName = ormGetDatabaseName(args);
            const [_platform, environment] =
                CliArguments.getPlatformAndEnvironment(args);
            const workerProject = BaseWorkerProject.create(args);

            // Get the adapter type
            const dbConfig = await getOrmAdapterType(
                workerProject,
                databaseName,
                environment,
            );

            if (dbConfig.adapterType !== 'drizzle') {
                throw new Error(
                    `Unsupported adapter type for schema sync: ${dbConfig.adapterType}`,
                );
            }

            // Scope push to this worker's own tables so a shared database's
            // other tables are left untouched (drizzle-kit otherwise treats
            // every unknown table as a deletion). Passed via the config's
            // tablesFilter env read — drizzle-kit's `push` rejects mixing
            // `--config` with a `--tablesFilter` CLI flag. `--all-tables` opts
            // out for intentional, destructive cleanup of a database you own.
            let tablesFilter: string[] | undefined;
            if (!args.allTables) {
                const settingsModule =
                    await workerProject.loadSettingsModule(environment);
                const tableNames = ormGetDatabaseTableNames(
                    settingsModule.settings,
                    databaseName,
                );
                if (tableNames.length > 0) {
                    tablesFilter = tableNames;
                }
            }

            const drizzleArgs = [];
            if (args.force) {
                drizzleArgs.push('--force');
            }
            if (args.strict) {
                drizzleArgs.push('--strict');
            }
            if (args.verbose) {
                drizzleArgs.push('--verbose');
            }

            try {
                await ormRunDrizzleCommand(
                    workerProject,
                    environment,
                    databaseName,
                    dbConfig.databaseType,
                    'push',
                    drizzleArgs,
                    tablesFilter,
                );
                console.log('✅ Schema pushed to database successfully');
            } catch (error) {
                console.error('❌ Failed to push schema to database:', error);
                process.exit(1);
            }
        };
    }
}
