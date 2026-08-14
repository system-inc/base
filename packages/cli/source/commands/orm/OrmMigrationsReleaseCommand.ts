// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as yargs from 'yargs';

import { CliArguments } from '../../common/CliHelpers';
import {
    appendReleasedTags,
    readReleasedTags,
} from '../../orm/drizzle/OrmReleaseFile';
import { BaseWorkerProject } from '../../project/BaseWorkerProject';
import { ormGetDatabaseName } from './OrmCommand';

/**
 * Promote every migration currently on disk into the released list in
 * `release.ts`. Performs a surgical append-only edit — comments and
 * formatting elsewhere in the file are preserved.
 *
 * This is a convenience over editing the file by hand. The file is
 * the contract; this command is just a typing shortcut.
 */
export class OrmMigrationsReleaseCommand implements yargs.CommandModule {
    command = 'migration:release [worker]';
    aliases = ['migrations:release'];
    describe =
        'Promote current migrations to the released list (release.ts) — deploys are blocked until released';

    builder(args: yargs.Argv) {
        return args.positional('worker', {
            describe: 'Worker to operate on. Inferred from CWD if omitted.',
            type: 'string',
        });
    }

    get handler(): (args: yargs.ArgumentsCamelCase) => void | Promise<void> {
        return async (args: yargs.Arguments) => {
            const databaseName = ormGetDatabaseName(args);
            const [_platform, environment] =
                CliArguments.getPlatformAndEnvironment(args);
            const workerProject = BaseWorkerProject.create(args);

            const settingsModule =
                await workerProject.loadSettingsModule(environment);

            const ormSettings = settingsModule.settings.orm?.[databaseName];
            if (!ormSettings) {
                console.error(
                    `No ORM settings for database '${databaseName}'.`,
                );
                process.exit(1);
            }

            // We get the tags from settings.orm[db].migrations.journal.entries
            // — the same bundle the worker would consume. Stubbed during
            // load, so we read the file directly here instead.
            const migrationTags = await readMigrationTagsFromJournal(
                workerProject,
                databaseName,
            );

            if (migrationTags.length === 0) {
                console.log('No migrations on disk to release.');
                return;
            }

            const alreadyReleased = new Set(
                readReleasedTags(workerProject, databaseName),
            );
            const willAdd = migrationTags.filter(
                (t) => !alreadyReleased.has(t),
            );

            if (willAdd.length === 0) {
                console.log(
                    '✓ All migrations are already in the released list.',
                );
                return;
            }

            const added = appendReleasedTags(
                workerProject,
                databaseName,
                willAdd,
            );

            console.log(`✏️  Added to release.ts:`);
            for (const tag of added) {
                console.log(`     '${tag}',`);
            }
            console.log(
                `✅ Review the change: git diff database/${databaseName}/drizzle/release.ts`,
            );
        };
    }
}

async function readMigrationTagsFromJournal(
    workerProject: BaseWorkerProject,
    databaseName: string,
): Promise<string[]> {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const journalPath = path.join(
        workerProject.workerFolder,
        'database',
        databaseName,
        'drizzle',
        'migrations',
        'meta',
        '_journal.json',
    );
    if (!fs.existsSync(journalPath)) {
        return [];
    }
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as {
        entries?: Array<{ tag: string }>;
    };
    return (journal.entries ?? []).map((e) => e.tag);
}
