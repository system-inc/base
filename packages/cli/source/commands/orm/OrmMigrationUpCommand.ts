// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as yargs from 'yargs';

import { CliArguments } from '../../common/CliHelpers';
import { BaseWorkerProject } from '../../project/BaseWorkerProject';
import { ormGetDatabaseName } from './OrmCommand';
import { getOrmAdapterType } from './OrmCommandHelper';
import { ormRunDrizzleCommand } from './OrmRunDrizzleCommand';

/**
 * Command for upgrading migration snapshot metadata to the current drizzle-kit
 * format. Maps to: migration:upgrade-metadata (alias: migration:up).
 */
export class OrmMigrationUpCommand implements yargs.CommandModule {
    command = 'migration:upgrade-metadata [worker]';
    aliases = ['migration:up'];
    describe =
        'Upgrade local migration snapshot files to the current drizzle-kit format (run after upgrading drizzle-kit). Does not touch the database';

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
                    `Unsupported adapter type for migration up: ${dbConfig.adapterType}`,
                );
            }

            try {
                await ormRunDrizzleCommand(
                    workerProject,
                    environment,
                    databaseName,
                    dbConfig.databaseType,
                    'up',
                );
                console.log('✅ Migration metadata updated successfully');
            } catch (error) {
                console.error('❌ Failed to update migration metadata:', error);
                process.exit(1);
            }
        };
    }
}
