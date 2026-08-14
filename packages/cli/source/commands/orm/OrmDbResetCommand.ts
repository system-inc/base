// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as path from 'path';
import * as yargs from 'yargs';

import { EnvironmentType } from '@system-inc/base-foundation/configuration/Environment';
import {
    isOrmSettingsD1,
    isOrmSettingsDurableSQLite,
} from '@system-inc/base-foundation/orm/settings/OrmSettings';
import { CliArguments } from '../../common/CliHelpers';
import {
    BaseWorkerProject,
    resolvePersistTo,
} from '../../project/BaseWorkerProject';
import { ormGetDatabaseName } from './OrmCommand';

/**
 * `base orm db:reset --local` — wipes wrangler's local database state
 * (`.wrangler/state/v3/d1/` for D1, `.wrangler/state/v3/do/` for
 * durable-SQLite). Local-only by design — the command refuses to do
 * anything without `--local`, so there's no path to accidentally wipe
 * remote state.
 *
 * After reset, wrangler recreates an empty database on next run. Apply
 * migrations with `base orm migration:run --local`.
 *
 * v1 scope: `--database <name>` selects database *type* for the wipe
 * (all D1 or all durable in the worker). True per-database scoping
 * (which D1 binding's sqlite file to delete) would require parsing
 * wrangler.toml + binding-to-filename mapping — future enhancement.
 */
export class OrmDbResetCommand implements yargs.CommandModule {
    command = 'db:reset [worker]';
    describe =
        'Wipe the worker’s local database state — requires --local (local only)';

    builder(args: yargs.Argv) {
        return args
            .positional('worker', {
                describe: 'Worker to operate on. Inferred from CWD if omitted.',
                type: 'string',
            })
            .option('local', {
                describe:
                    "Required. Resets wrangler's local D1/DO state. base does not support resetting remote databases from this command.",
                type: 'boolean',
                default: false,
            })
            .option('force', {
                describe:
                    'Allow reset outside Development environment. Use with care.',
                type: 'boolean',
                default: false,
            })
            .option('dry-run', {
                describe:
                    'Preview which files would be deleted without touching anything.',
                type: 'boolean',
                default: false,
            })
            .option('persist-to', {
                type: 'string',
                describe:
                    "Directory of wrangler's local state to reset. Overrides the workspace package.json `base.persistTo`.",
            });
    }

    async handler(args: yargs.Arguments) {
        if (args.local !== true) {
            console.error(
                '❌ --local is required. `base orm db:reset` will not touch remote databases. Use a Cloudflare/PlanetScale dashboard or their respective CLIs for that.',
            );
            process.exit(1);
        }

        const [_platform, environment] =
            CliArguments.getPlatformAndEnvironment(args);
        if (environment !== EnvironmentType.Development && !args.force) {
            console.error(
                `❌ Refusing to reset local state for environment '${environment}'. Pass --force to override.`,
            );
            process.exit(1);
        }

        const workerProject = BaseWorkerProject.create(args);
        const settingsModule =
            await workerProject.loadSettingsModule(environment);
        const ormSettings = settingsModule.settings.orm;
        if (!ormSettings) {
            console.error(
                `Worker '${workerProject.worker}' has no ORM databases declared in settings.ts.`,
            );
            process.exit(1);
        }

        // Decide scope: --database scopes to one named entry; otherwise all.
        const targetName =
            typeof args.database === 'string'
                ? ormGetDatabaseName(args)
                : undefined;
        const targets = Object.entries(ormSettings).filter(
            ([name, cfg]) =>
                cfg !== undefined &&
                (targetName === undefined || name === targetName),
        );
        if (targets.length === 0) {
            console.error(
                targetName
                    ? `No ORM database '${targetName}' found in settings.ts.`
                    : `No resettable ORM databases found in settings.ts.`,
            );
            process.exit(1);
        }

        // Build the set of directories to wipe based on database types.
        // With a shared persistence root (resolvePersistTo), the state
        // being wiped is shared by every worker pointed at that root —
        // warn, since "reset this worker's database" then means "reset
        // the databases of every worker persisting here".
        const dirsToWipe = new Set<string>();
        const persistTo = resolvePersistTo(args, workerProject.workerFolder);
        if (persistTo) {
            console.log(
                `⚠️  Shared local persistence root: ${persistTo} — this state is shared by all workers configured with the same persistTo.`,
            );
        }
        const stateRoot = persistTo
            ? path.join(persistTo, 'v3')
            : path.join(workerProject.workerFolder, '.wrangler', 'state', 'v3');
        const unsupported: string[] = [];

        for (const [name, cfg] of targets) {
            if (!cfg) continue;
            if (isOrmSettingsD1(cfg)) {
                dirsToWipe.add(path.join(stateRoot, 'd1'));
            } else if (isOrmSettingsDurableSQLite(cfg)) {
                dirsToWipe.add(path.join(stateRoot, 'do'));
            } else {
                unsupported.push(
                    `${name} (${cfg.databaseType?.driver ?? 'unknown'})`,
                );
            }
        }

        if (unsupported.length > 0) {
            console.log(
                `Skipping databases with no local state: ${unsupported.join(', ')}`,
            );
        }

        if (dirsToWipe.size === 0) {
            console.log(
                'Nothing to reset — no D1 or durable-SQLite databases in the target set.',
            );
            return;
        }

        const dryRun = args.dryRun === true;
        const action = dryRun ? 'Would delete' : 'Deleting';

        for (const dir of dirsToWipe) {
            if (!fs.existsSync(dir)) {
                console.log(`  (no state at ${dir} — nothing to delete)`);
                continue;
            }
            console.log(`  ${action}: ${dir}`);
            if (!dryRun) {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        }

        if (dryRun) {
            console.log('Dry run — no files deleted.');
            return;
        }

        console.log('');
        console.log(`✅ Reset complete for worker '${workerProject.worker}'.`);
        console.log('');
        console.log('Next:');
        console.log(
            `   npx base orm migration:run --local --worker ${workerProject.worker}${targetName ? ` --database ${targetName}` : ''}`,
        );
    }
}
