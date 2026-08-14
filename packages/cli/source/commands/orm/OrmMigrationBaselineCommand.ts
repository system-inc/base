// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as path from 'path';
import * as yargs from 'yargs';

import { CliArguments } from '../../common/CliHelpers';
import {
    drizzleMigrationsTableName,
    ormGetDrizzleBoilerplatePath,
} from '../../orm/drizzle/OrmGetDrizzleBoilerplate';
import {
    buildMigrationBaselineSql,
    readMigrationBaselineEntries,
} from '../../orm/drizzle/OrmMigrationBaseline';
import { BaseWorkerProject } from '../../project/BaseWorkerProject';
import { ormGetDatabaseName } from './OrmCommand';
import { getOrmAdapterType } from './OrmCommandHelper';

/**
 * Command for baselining an existing database: prints SQL that creates
 * the drizzle migration tracking table and marks every migration file in
 * the journal as applied, without running any of them.
 * Maps to: migration:baseline
 *
 * For adopting a database whose schema already matches the migration
 * history (e.g. it was created by hand or by another tool) so that
 * `migration:run` only applies migrations generated afterward. Output
 * goes to stdout as pure SQL — run it against the target database
 * manually. Does not touch the database itself.
 */
export class OrmMigrationBaselineCommand implements yargs.CommandModule {
    command = 'migration:baseline [worker]';
    describe =
        'Print SQL that creates the migration tracking table and marks all migration files as applied — for adopting a database whose schema already matches the migration history. Does not touch the database';

    get builder(): yargs.CommandBuilder | undefined {
        return (args: yargs.Argv) => {
            return args.positional('worker', {
                describe: 'Worker to operate on. Inferred from CWD if omitted.',
                type: 'string',
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
                    `Unsupported adapter type for migration baseline: ${dbConfig.adapterType}`,
                );
            }

            const databaseType = dbConfig.databaseType;
            if (databaseType.driver === 'durable') {
                throw new Error(
                    'Durable Object SQLite databases cannot be baselined from the CLI — ' +
                        'each Durable Object tracks and applies its own migrations at ' +
                        'runtime, inside its private SQLite.',
                );
            }

            try {
                const migrationsFolder = path.join(
                    ormGetDrizzleBoilerplatePath(workerProject, databaseName),
                    'migrations',
                );
                const entries = readMigrationBaselineEntries(migrationsFolder);
                const tableName = drizzleMigrationsTableName(
                    workerProject.worker,
                );

                const header = [
                    `-- Migration baseline for worker '${workerProject.worker}', database '${databaseName}' (${databaseType.dialect}/${databaseType.driver}).`,
                    `-- Creates the drizzle migration tracking table and marks ${entries.length} migration(s)`,
                    `-- as applied without running them. Run against a database whose schema already`,
                    `-- matches the migration history. Assumes the tracking table is empty —`,
                    `-- re-running duplicates the INSERTs.`,
                ].join('\n');

                console.log(
                    header +
                        '\n\n' +
                        buildMigrationBaselineSql(
                            databaseType.dialect,
                            tableName,
                            entries,
                        ),
                );
            } catch (error) {
                console.error('❌ Failed to build migration baseline:', error);
                process.exit(1);
            }
        };
    }
}
