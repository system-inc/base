// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as yargs from 'yargs';

import { CliArguments } from '../../common/CliHelpers';
import { BaseWorkerProject } from '../../project/BaseWorkerProject';
import { ormGetDatabaseName } from './OrmCommand';
import { getOrmAdapterType } from './OrmCommandHelper';
import { ormRunDrizzleCommand } from './OrmRunDrizzleCommand';

/**
 * Command for dropping/deleting migration files.
 * Maps to: migration:drop
 */
export class OrmMigrationDropCommand implements yargs.CommandModule {
    command = 'migration:drop [worker]';
    describe =
        'Delete a migration file from the migrations folder — local only, not a DB rollback';

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
                    `Unsupported adapter type for migration drop: ${dbConfig.adapterType}`,
                );
            }

            console.log(
                '⚠️  Warning: This will delete migration files from your migrations folder.',
            );
            console.log(
                '   This does NOT rollback database changes, only removes the files.',
            );

            try {
                await ormRunDrizzleCommand(
                    workerProject,
                    environment,
                    databaseName,
                    dbConfig.databaseType,
                    'drop',
                );
                console.log('✅ Migration files dropped successfully');
            } catch (error) {
                console.error('❌ Failed to drop migration files:', error);
                process.exit(1);
            }
        };
    }
}
