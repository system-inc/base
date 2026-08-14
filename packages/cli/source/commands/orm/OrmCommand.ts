// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as yargs from 'yargs';

import { DefaultConfigurationKey } from '@system-inc/base-common/configuration/NamedConfiguration';
import { OrmDbResetCommand } from './OrmDbResetCommand';
import { OrmMigrationBaselineCommand } from './OrmMigrationBaselineCommand';
import { OrmMigrationCheckCommand } from './OrmMigrationCheckCommand';
import { OrmMigrationDropCommand } from './OrmMigrationDropCommand';
import { OrmMigrationRunCommand } from './OrmMigrationRunCommand';
import { OrmMigrationsReleaseCommand } from './OrmMigrationsReleaseCommand';
import { OrmMigrationUpCommand } from './OrmMigrationUpCommand';
import { OrmSchemaCheckCommand } from './OrmSchemaCheckCommand';
import { OrmSchemaDiffCommand } from './OrmSchemaDiffCommand';
import { OrmSchemaIntrospectCommand } from './OrmSchemaIntrospectCommand';
import { OrmSchemaSyncCommand } from './OrmSchemaSyncCommand';
import { OrmSchemaValidateCompatibilityCommand } from './OrmSchemaValidateCompatibilityCommand';
import { OrmStudioCommand } from './OrmStudioCommand';

/**
 * Command for performing database operations.
 */
export class OrmCommand implements yargs.CommandModule {
    command = 'orm <command>';
    describe = 'Performs specific database operations.';

    get builder(): yargs.CommandBuilder | undefined {
        return (args: yargs.Argv) => {
            return args
                .option('database', {
                    // alias: 'd', -- TODO enable this alias when we rip out TypeORM, currently conflicts with TypeORM CLI
                    type: 'string',
                    describe:
                        'The name of the database to use. If not specified, the default database will be used.',
                })
                .command(new OrmSchemaDiffCommand())
                .command(new OrmSchemaCheckCommand())
                .command(new OrmSchemaSyncCommand())
                .command(new OrmSchemaIntrospectCommand())
                .command(new OrmSchemaValidateCompatibilityCommand())
                .command(new OrmMigrationRunCommand())
                .command(new OrmMigrationCheckCommand())
                .command(new OrmMigrationBaselineCommand())
                .command(new OrmMigrationDropCommand())
                .command(new OrmMigrationUpCommand())
                .command(new OrmMigrationsReleaseCommand())
                .command(new OrmDbResetCommand())
                .command(new OrmStudioCommand())
                .demandCommand();
            // Worker is required per-subcommand (most need a single
            // worker; `schema:check` supports `--all-workers`). Each
            // subcommand validates via `BaseWorkerProject.create`,
            // which prints a clear "No worker specified" error and
            // exits non-zero — so we don't enforce it at this level.
        };
    }

    async handler(_args: yargs.Arguments) {
        // this should never be called because all of the processing is done via subcommands
        throw new Error('Method not implemented.');
    }
}

export function ormGetDatabaseName(args: yargs.Arguments): string {
    // if the name is specified, return it
    if (args.database) {
        return args.database as string;
    }
    // otherwise, return undefined to use the default database
    return DefaultConfigurationKey;
}
