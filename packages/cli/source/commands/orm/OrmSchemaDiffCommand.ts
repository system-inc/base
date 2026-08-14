// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as path from 'path';
import * as yargs from 'yargs';

import { CliArguments } from '../../common/CliHelpers';
import {
    ormAddJsonImportAttribute,
    ormGetDrizzleBoilerplatePath,
    ormWriteDrizzleSchemaFile,
} from '../../orm/drizzle/OrmGetDrizzleBoilerplate';
import { foldUnreleasedMigrations } from '../../orm/drizzle/OrmReleaseFile';
import { BaseWorkerProject } from '../../project/BaseWorkerProject';
import { validateMigrations } from '../workspace/DurableSqliteMigrationValidator';
import { displayValidationResults } from '../workspace/DurableSqliteMigrationValidatorDisplay';
import { ormGetDatabaseName } from './OrmCommand';
import { getOrmAdapterType } from './OrmCommandHelper';
import { ormRunDrizzleCommand } from './OrmRunDrizzleCommand';

/**
 * Command for generating migration files based on schema changes.
 * Maps to: schema:generate (alias: schema:diff)
 */
export class OrmSchemaDiffCommand implements yargs.CommandModule {
    command = 'schema:generate [worker]';
    aliases = ['schema:diff'];
    describe =
        'Regenerate schema.generated.ts from your entities and create a migration for the changes';

    get builder(): yargs.CommandBuilder | undefined {
        return (args: yargs.Argv) => {
            return args
                .positional('worker', {
                    describe:
                        'Worker to operate on. Inferred from CWD if omitted.',
                    type: 'string',
                })
                .option('name', {
                    alias: 'm',
                    describe: 'Custom name for the migration file',
                    type: 'string',
                })
                .option('custom', {
                    describe: 'Generate an empty custom migration file',
                    type: 'boolean',
                })
                .option('fold', {
                    describe:
                        'Auto-fold unreleased migrations. Disable with --no-fold to preserve every iteration as a separate migration file.',
                    type: 'boolean',
                    default: true,
                });
        };
    }

    get handler(): (args: yargs.ArgumentsCamelCase) => void | Promise<void> {
        return async (args: yargs.Arguments) => {
            const databaseName = ormGetDatabaseName(args);
            const [_platform, environment] =
                CliArguments.getPlatformAndEnvironment(args);
            const workerProject = BaseWorkerProject.create(args);

            const dbConfig = await getOrmAdapterType(
                workerProject,
                databaseName,
                environment,
            );

            if (dbConfig.adapterType !== 'drizzle') {
                throw new Error(
                    `Unsupported adapter type for schema diff: ${dbConfig.adapterType}`,
                );
            }

            const drizzleArgs = [];
            if (args.name) {
                drizzleArgs.push(`--name=${args.name}`);
            }
            if (args.custom) {
                drizzleArgs.push('--custom');
            }

            const migrationsFolder = path.join(
                ormGetDrizzleBoilerplatePath(workerProject, databaseName),
                'migrations',
            );
            const journalPath = path.join(
                migrationsFolder,
                'meta',
                '_journal.json',
            );

            try {
                // A migrations folder without meta/_journal.json makes
                // drizzle-kit crash (it only creates the journal when the
                // folder is absent). The state is easy to reach: deleting the
                // folder's files but not its directories leaves an empty husk
                // behind, since git never tracks the empty directories.
                // Remove the husk so drizzle-kit starts fresh; refuse to
                // guess when real migrations exist without their journal.
                if (
                    fs.existsSync(migrationsFolder) &&
                    !fs.existsSync(journalPath)
                ) {
                    const sqlFiles = fs
                        .readdirSync(migrationsFolder)
                        .filter((file) => file.endsWith('.sql'));
                    if (sqlFiles.length > 0) {
                        throw new Error(
                            `${migrationsFolder} contains ${sqlFiles.length} migration file(s) but no meta/_journal.json. ` +
                                'Restore the meta folder from git, or delete the whole drizzle folder to start over.',
                        );
                    }
                    fs.rmSync(migrationsFolder, {
                        recursive: true,
                        force: true,
                    });
                }

                // Pre-generate schema.generated.ts from the in-memory
                // drizzle schema (resolved in our ts-node env where
                // decorators work). drizzle-kit then reads a pure-drizzle
                // file and never touches foundation source.
                const settingsModule =
                    await workerProject.loadSettingsModule(environment);
                ormWriteDrizzleSchemaFile(
                    workerProject,
                    databaseName,
                    settingsModule.settings,
                );

                // Auto-fold: delete any unreleased migrations before
                // running drizzle-kit so it regenerates a single
                // migration absorbing all changes since the last
                // released one. Released migrations are append-only.
                if (args.fold !== false) {
                    const folded = foldUnreleasedMigrations(
                        workerProject,
                        databaseName,
                    );
                    if (folded.length > 0) {
                        console.log(
                            `✏️  Folding ${folded.length} unreleased migration(s) so the next generate absorbs them:`,
                        );
                        for (const tag of folded) {
                            console.log(`     - ${tag}`);
                        }
                    }
                }

                await ormRunDrizzleCommand(
                    workerProject,
                    environment,
                    databaseName,
                    dbConfig.databaseType,
                    'generate',
                    drizzleArgs,
                );

                // drizzle-kit reports failures by printing them and still
                // exiting 0, so verify the journal it must produce (even a
                // no-change generate writes it) instead of trusting the
                // exit code.
                if (!fs.existsSync(journalPath)) {
                    throw new Error(
                        'drizzle-kit did not produce migrations/meta/_journal.json — it likely failed; see its output above.',
                    );
                }
                console.log('✅ Migration files generated successfully');

                // Patch the JSON import in drizzle-kit's migrations.js
                // shim to include `with { type: 'json' }` — required by
                // Node 22's strict ESM JSON loading. wrangler/esbuild
                // also accepts the attribute, so the same file works in
                // both the worker bundle and any CLI path that loads it.
                if (dbConfig.databaseType.driver === 'durable') {
                    ormAddJsonImportAttribute(workerProject, databaseName);
                }

                if (dbConfig.databaseType.driver === 'durable') {
                    console.log(
                        `\n[${workerProject.worker}]: Validating durable-sqlite migrations for database '${databaseName}'...`,
                    );

                    if (fs.existsSync(migrationsFolder)) {
                        const sqlFiles = fs
                            .readdirSync(migrationsFolder)
                            .filter((f) => f.endsWith('.sql'))
                            .sort();

                        const migrations: Record<string, string> = {};
                        for (const file of sqlFiles) {
                            const key = file.replace('.sql', '');
                            migrations[key] = fs.readFileSync(
                                path.join(migrationsFolder, file),
                                'utf8',
                            );
                        }

                        const validationResult = validateMigrations(
                            migrations,
                            environment,
                        );

                        displayValidationResults(
                            validationResult,
                            environment,
                            databaseName,
                        );

                        if (!validationResult.valid) {
                            process.exit(1);
                        }
                    }
                }
            } catch (error) {
                console.error('❌ Failed to generate migration files:', error);
                process.exit(1);
            }
        };
    }
}
