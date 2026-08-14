// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as path from 'path';
import * as yargs from 'yargs';

import { resolveWranglerBin } from '../../cloudflare/Wrangler';
import { CliArguments } from '../../common/CliHelpers';
import { Run } from '../../common/Run';
import { ormGetDrizzleBoilerplatePath } from '../../orm/drizzle/OrmGetDrizzleBoilerplate';
import { readMigrationBaselineEntries } from '../../orm/drizzle/OrmMigrationBaseline';
import {
    BaseWorkerProject,
    resolvePersistTo,
} from '../../project/BaseWorkerProject';
import { WranglerToml } from '../../project/WranglerToml';
import { ormGetDatabaseName } from './OrmCommand';
import { getOrmAdapterType } from './OrmCommandHelper';
import { ormRunDrizzleCommand } from './OrmRunDrizzleCommand';

/**
 * Command for running migrations against the database.
 * Maps to: migration:run
 *
 * For remote databases (planetscale, remote d1), goes through drizzle-kit
 * `migrate`. For local D1 (`--local`), delegates to
 * `wrangler d1 migrations apply <name> --local --env <env>` because
 * drizzle-kit has no local-d1 mode — its `d1-http` driver always talks
 * to the Cloudflare API.
 */
export class OrmMigrationRunCommand implements yargs.CommandModule {
    command = 'migration:run [worker]';
    describe =
        'Apply pending migration files to the database (validates migration history first)';

    get builder(): yargs.CommandBuilder | undefined {
        return (args: yargs.Argv) => {
            return args
                .positional('worker', {
                    describe:
                        'Worker to operate on. Inferred from CWD if omitted.',
                    type: 'string',
                })
                .option('local', {
                    describe:
                        "Apply migrations to wrangler's local D1 sqlite instead of remote D1. Only valid when the target database is D1.",
                    type: 'boolean',
                    default: false,
                })
                .option('persist-to', {
                    type: 'string',
                    describe:
                        "Directory for wrangler's local state (with --local). Overrides the workspace package.json `base.persistTo`; must match what `base develop` uses or migrations land in a different local database.",
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
                    `Unsupported adapter type for migration run: ${dbConfig.adapterType}`,
                );
            }

            // Validate migration-history integrity BEFORE applying. Neither
            // drizzle's `migrate` nor wrangler's local apply checks for
            // collisions / malformed / stale snapshots, so without this a
            // corrupt history would be applied blindly. drizzle-kit `check`
            // exits non-zero on a problem, which ormRunDrizzleCommand turns
            // into a throw.
            try {
                await ormRunDrizzleCommand(
                    workerProject,
                    environment,
                    databaseName,
                    dbConfig.databaseType,
                    'check',
                );
            } catch {
                console.error(
                    '❌ Migration history check failed — not applying. ' +
                        'Run `base orm migration:check` for details.',
                );
                process.exit(1);
            }

            const isLocal = args.local === true;
            if (isLocal) {
                if (dbConfig.databaseType.driver !== 'd1') {
                    throw new Error(
                        `--local only applies to D1 databases (got driver '${dbConfig.databaseType.driver}'). Use \`base orm migration:run\` (no --local) for remote databases.`,
                    );
                }
                await runWranglerLocalD1Migrations(
                    workerProject,
                    environment,
                    (dbConfig as { binding: string }).binding,
                    resolvePersistTo(args, workerProject.workerFolder),
                );
                return;
            }

            try {
                const output = await ormRunDrizzleCommand(
                    workerProject,
                    environment,
                    databaseName,
                    dbConfig.databaseType,
                    'migrate',
                );

                // SAY WHETHER ANYTHING RAN. drizzle-kit prints the same
                // "migrations applied successfully" whether it executed a
                // hundred statements or found nothing to do, so its own output
                // cannot distinguish the two — and the difference is the entire
                // question you ran the command to answer. It names each
                // migration it actually applies, so a run that names none
                // applied none.
                const onDisk = readMigrationBaselineEntries(
                    path.join(
                        ormGetDrizzleBoilerplatePath(
                            workerProject,
                            databaseName,
                        ),
                        'migrations',
                    ),
                );
                const applied = onDisk.filter((entry) =>
                    output.includes(entry.tag),
                );

                if (applied.length === 0) {
                    console.log(
                        `✅ '${databaseName}' is up to date in ${environment} — ` +
                            `${onDisk.length} migration(s) on disk, all already applied. Nothing ran.`,
                    );
                } else {
                    console.log(
                        `✅ Applied ${applied.length} migration(s) to '${databaseName}' in ${environment}: ` +
                            `${applied.map((entry) => entry.tag).join(', ')}.`,
                    );
                }
            } catch (error) {
                console.error('❌ Failed to run migrations:', error);
                process.exit(1);
            }
        };
    }
}

/**
 * Resolves the d1 binding's `database_name` from the worker's wrangler.toml
 * for the given environment, then shells out to
 * `wrangler d1 migrations apply <name> --local --env <env>`. wrangler reads
 * `migrations_dir` (drizzle's output dir) from the same wrangler.toml and
 * applies the SQL files to the local sqlite under `persistTo` (when set)
 * or the worker's own `.wrangler/state/v3/d1/...`.
 */
async function runWranglerLocalD1Migrations(
    workerProject: BaseWorkerProject,
    environment: string,
    binding: string,
    persistTo: string | undefined,
): Promise<void> {
    const d1 = WranglerToml.findD1Database(workerProject, environment, binding);

    const commandArgs = [
        'd1',
        'migrations',
        'apply',
        d1.database_name,
        '--local',
        '--env',
        environment,
    ];
    // Same persistence root `base develop` runs against (resolvePersistTo)
    // — otherwise migrations apply to a local database dev never reads.
    if (persistTo) {
        commandArgs.push('--persist-to', persistTo);
    }
    console.log(`Running wrangler command: ${commandArgs.join(' ')}`);
    try {
        // Anchor wrangler at the worker folder so it reads the right
        // wrangler.toml regardless of where the user invoked `base` from.
        await Run.program(resolveWranglerBin(), commandArgs, {
            cwd: workerProject.workerFolder,
        });
        console.log('✅ Local D1 migrations applied successfully');
    } catch (error) {
        console.error('❌ Failed to apply local D1 migrations:', error);
        process.exit(1);
    }
}
