// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as path from 'path';
import * as yargs from 'yargs';

import { OrmAdapterType } from '@system-inc/base-foundation/orm/database/adapter/OrmAdapterType';
import {
    isOrmSettingsD1,
    OrmSettings,
} from '@system-inc/base-foundation/orm/settings/OrmSettings';
import { miniflareD1SqlitePath } from '../../cloudflare/MiniflareState';
import { CliArguments } from '../../common/CliHelpers';
import {
    BaseWorkerProject,
    resolvePersistTo,
} from '../../project/BaseWorkerProject';
import { WranglerToml } from '../../project/WranglerToml';
import { ormGetDatabaseName } from './OrmCommand';
import { getOrmAdapterType } from './OrmCommandHelper';
import { OrmLocalD1Target, ormRunDrizzleCommand } from './OrmRunDrizzleCommand';

/**
 * Command for launching Drizzle Studio GUI.
 * Maps to: db:studio
 *
 * Without `--local`, studio connects to the REMOTE database for the
 * resolved environment (for D1 via drizzle-kit's `d1-http` driver, which
 * only speaks to the Cloudflare API). `--local` instead opens wrangler's
 * local D1 sqlite — the state `base develop` reads and writes — by
 * resolving the binding's `database_id` to miniflare's on-disk file.
 */
export class OrmStudioCommand implements yargs.CommandModule {
    command = 'db:studio [worker]';
    describe = 'Open Drizzle Studio — a browser GUI for the database';

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
                        "Browse wrangler's local D1 sqlite instead of the remote database. Only valid when the target database is D1.",
                    type: 'boolean',
                    default: false,
                })
                .option('persist-to', {
                    type: 'string',
                    describe:
                        "Directory of wrangler's local state (with --local). Overrides the workspace package.json `base.persistTo`; must match what `base develop` uses or studio opens a different local database.",
                })
                .option('port', {
                    describe: 'Port to run studio on',
                    type: 'number',
                    default: 4983,
                })
                .option('host', {
                    describe: 'Host to bind studio to',
                    type: 'string',
                    default: 'localhost',
                })
                .option('verbose', {
                    describe: 'Show verbose output',
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
                    `Unsupported adapter type for studio: ${dbConfig.adapterType}`,
                );
            }

            const localD1 =
                args.local === true
                    ? resolveLocalD1Target(
                          args,
                          workerProject,
                          environment,
                          dbConfig,
                      )
                    : undefined;
            if (!localD1) {
                // Studio otherwise connects wherever the environment's real
                // credentials point — make that unmissable, since browsing
                // "my database" locally and editing production are one
                // forgotten flag apart.
                console.log(
                    `⚠️  Connecting to the REMOTE database for environment '${environment}'.` +
                        (dbConfig.databaseType.driver === 'd1'
                            ? " Use --local to browse wrangler's local D1 instead."
                            : ''),
                );
            }

            const drizzleArgs = [];
            if (args.port) {
                drizzleArgs.push(`--port=${args.port}`);
            }
            if (args.host) {
                drizzleArgs.push(`--host=${args.host}`);
            }
            if (args.verbose) {
                drizzleArgs.push('--verbose');
            }

            console.log('🚀 Launching Drizzle Studio...');
            console.log(
                `   URL: http://${args.host || 'localhost'}:${args.port || 4983}`,
            );

            try {
                await ormRunDrizzleCommand(
                    workerProject,
                    environment,
                    databaseName,
                    dbConfig.databaseType,
                    'studio',
                    drizzleArgs,
                    undefined,
                    localD1,
                );
            } catch (error) {
                console.error('❌ Failed to launch studio:', error);
                process.exit(1);
            }
        };
    }
}

/**
 * Resolves `--local` to the sqlite file wrangler persists for the worker's
 * D1 binding: `database_id` from wrangler.toml, hashed to miniflare's
 * filename, under the shared `persistTo` root (or the worker's own
 * `.wrangler/state`). Exits with guidance when the database has no local
 * state yet.
 */
function resolveLocalD1Target(
    args: yargs.Arguments,
    workerProject: BaseWorkerProject,
    environment: string,
    dbConfig: OrmSettings<OrmAdapterType>,
): OrmLocalD1Target {
    if (!isOrmSettingsD1(dbConfig)) {
        throw new Error(
            `--local only applies to D1 databases (got driver '${dbConfig.databaseType.driver}'). Use \`base orm db:studio\` (no --local) for remote databases.`,
        );
    }

    const d1Database = WranglerToml.findD1Database(
        workerProject,
        environment,
        dbConfig.binding,
    );
    const persistTo = resolvePersistTo(args, workerProject.workerFolder);
    const stateRoot = persistTo
        ? path.join(persistTo, 'v3')
        : path.join(workerProject.workerFolder, '.wrangler', 'state', 'v3');
    const sqlitePath = miniflareD1SqlitePath(stateRoot, d1Database.database_id);

    if (!fs.existsSync(sqlitePath)) {
        console.error(
            `❌ No local state for D1 database '${d1Database.database_name}' (looked for ${sqlitePath}).\n` +
                '   Create it by running the worker (`base develop`) or applying migrations (`base orm migration:run --local`).\n' +
                '   If it exists elsewhere, pass the matching --persist-to.',
        );
        process.exit(1);
    }

    console.log(
        `📂 Browsing LOCAL D1 database '${d1Database.database_name}': ${sqlitePath}`,
    );
    return { sqlitePath };
}
