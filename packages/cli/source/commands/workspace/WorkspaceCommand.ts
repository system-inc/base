// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as yargs from 'yargs';

import { WorkspaceCreateCommand } from './WorkspaceCreateCommand';
import { WorkspaceSecretsCommand } from './WorkspaceSecretsCommand';

/**
 * `base workspace <subcommand>` — workspace *management* commands only.
 * Per-worker actions (test, deploy, check) live at the top level with a
 * `--all-workers` flag to fan out. This namespace is just for things
 * that operate on the workspace itself: scaffolding (create) and
 * shared config (secrets).
 */
export class WorkspaceCommand implements yargs.CommandModule {
    command = 'workspace <command>';
    describe = 'Manage the workspace itself (create, secrets).';

    get builder(): yargs.CommandBuilder | undefined {
        return (args: yargs.Argv) => {
            return args
                .command(new WorkspaceCreateCommand())
                .command(new WorkspaceSecretsCommand())
                .demandCommand();
        };
    }

    async handler(_args: yargs.Arguments) {
        // this should never be called because all of the processing is done via subcommands
        throw new Error('Method not implemented.');
    }
}

export function getWorkspaceWorkers(args: yargs.Arguments): string[] {
    // Middleware in base-cli.ts guarantees this is set to the resolved
    // absolute workersFolder before any command handler runs.
    const workersFolder = args.workersFolder as string;
    // A subdirectory is a "worker" if it contains a settings.ts file.
    // This filters out incidental directories like .wrangler/, node_modules/,
    // shared/, etc. — anything that happens to sit next to real workers.
    const workerFolders = fs.readdirSync(workersFolder).filter((entry) => {
        const entryPath = workersFolder + '/' + entry;
        return (
            fs.lstatSync(entryPath).isDirectory() &&
            fs.existsSync(entryPath + '/settings.ts')
        );
    });
    console.log('Discovered workers:', workerFolders);
    return workerFolders;
}
