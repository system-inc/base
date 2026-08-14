// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as yargs from 'yargs';

import { CliArguments } from '../../common/CliHelpers';
import { BaseWorkerProject } from '../../project/BaseWorkerProject';
import { ormGetDatabaseName } from './OrmCommand';
import { getOrmAdapterType } from './OrmCommandHelper';
import { ormRunDrizzleCommand } from './OrmRunDrizzleCommand';

/**
 * Command for introspecting database schema and generating types.
 * Maps to: schema:introspect
 */
export class OrmSchemaIntrospectCommand implements yargs.CommandModule {
    command = 'schema:introspect [worker]';
    describe =
        'Read the live database and write its schema as reference into drizzle/introspect/ — not used by the build';

    get builder(): yargs.CommandBuilder | undefined {
        return (args: yargs.Argv) => {
            return args
                .positional('worker', {
                    describe:
                        'Worker to operate on. Inferred from CWD if omitted.',
                    type: 'string',
                })
                .option('casing', {
                    describe: 'Column name casing',
                    choices: ['camel', 'snake', 'preserve'],
                    type: 'string',
                })
                .option('tables-filter', {
                    describe: 'Filter tables by pattern',
                    type: 'string',
                })
                .option('schema-filter', {
                    describe: 'Filter schemas by pattern',
                    type: 'string',
                })
                .option('force', {
                    describe: 'Force overwrite existing files',
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
                    `Unsupported adapter type for schema introspect: ${dbConfig.adapterType}`,
                );
            }

            // Introspection output is reference material — drizzle's view of the
            // live DB (schema.ts/relations.ts/snapshot) — NOT something base
            // consumes (entities are the source of truth; schema.generated.ts is
            // derived from them). Write it to a dedicated, gitignored `introspect/`
            // dir instead of the `migrations/` folder, so it never gets confused
            // with real migrations or tripped over by lint. `--out` overrides the
            // config's `out` (allowed alongside `--config` for pull).
            const introspectOut = `./database/${databaseName}/drizzle/introspect`;
            const drizzleArgs = [`--out=${introspectOut}`];
            if (args.casing) {
                drizzleArgs.push(`--casing=${args.casing}`);
            }
            if (args.tablesFilter) {
                drizzleArgs.push(`--tablesFilter=${args.tablesFilter}`);
            }
            if (args.schemaFilter) {
                drizzleArgs.push(`--schemaFilter=${args.schemaFilter}`);
            }
            if (args.force) {
                drizzleArgs.push('--force');
            }

            try {
                await ormRunDrizzleCommand(
                    workerProject,
                    environment,
                    databaseName,
                    dbConfig.databaseType,
                    'pull',
                    drizzleArgs,
                );
                console.log(
                    `✅ Schema introspected to ${introspectOut} (reference only — not used by the build)`,
                );
            } catch (error) {
                console.error('❌ Failed to introspect schema:', error);
                process.exit(1);
            }
        };
    }
}
