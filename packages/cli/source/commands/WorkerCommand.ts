// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as yargs from 'yargs';

import { WorkerCreateCommand } from './workspace/WorkerCreateCommand';

/**
 * `base worker <subcommand>` — per-worker lifecycle commands that act
 * on a single worker (create today, more later).
 */
export class WorkerCommand implements yargs.CommandModule {
    command = 'worker <command>';
    describe = 'Runs a command for a worker.';

    get builder(): yargs.CommandBuilder | undefined {
        return (args: yargs.Argv) => {
            return args.command(new WorkerCreateCommand()).demandCommand();
        };
    }

    async handler(_args: yargs.Arguments) {
        // delegated to subcommands
        throw new Error('Method not implemented.');
    }
}
