// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as yargs from 'yargs';

import { CliArguments } from '../../common/CliHelpers';
import { BaseWorkerProject } from '../../project/BaseWorkerProject';
import { ormGetDatabaseName } from './OrmCommand';
import { getOrmAdapterType } from './OrmCommandHelper';
import { ormRunDrizzleCommand } from './OrmRunDrizzleCommand';

/**
 * Command for checking migration consistency.
 * Maps to: migration:check
 */
export class OrmMigrationCheckCommand implements yargs.CommandModule {
    command = 'migration:check [worker]';
    describe =
        'Check migration files for consistency — collisions, corrupt journal. Does not touch the database';

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
                    `Unsupported adapter type for migration check: ${dbConfig.adapterType}`,
                );
            }

            try {
                await ormRunDrizzleCommand(
                    workerProject,
                    environment,
                    databaseName,
                    dbConfig.databaseType,
                    'check',
                );
                console.log('✅ Migration consistency check completed');
            } catch (error) {
                console.error('❌ Migration check failed:', error);
                process.exit(1);
            }
        };
    }
}
