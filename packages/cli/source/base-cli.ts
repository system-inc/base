#!/usr/bin/env node
// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

// The TS runtime (raw-file extensions, ts-node, tsconfig-paths) must be
// registered before the command imports below: they transitively import
// `@system-inc/base-*`, and tsconfig-paths has to be live when they load so
// those specifiers resolve to a single copy of foundation/common rather than
// splitting between dist (eager require) and source (later ts-node). See
// RegisterTsRuntime for the full rationale.
import './startup/preload';
import './startup/RegisterTsRuntime';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { BundleCommand } from './commands/BundleCommand';
import { CheckCommand } from './commands/CheckCommand';
import { ContainerCommand } from './commands/ContainerCommand';
import { DeployCommand } from './commands/DeployCommand';
import { DevelopCommand } from './commands/DevelopCommand';
import { GqlCommand } from './commands/graphql/GqlCommand';
import { InfoCommand } from './commands/InfoCommand';
import { KeyGenCommand } from './commands/KeyGenCommand';
import { OrmCommand } from './commands/orm/OrmCommand';
import { TailCommand } from './commands/TailCommand';
import { TestCommand } from './commands/TestCommand';
import { WorkerCommand } from './commands/WorkerCommand';
import { WorkspaceCommand } from './commands/workspace/WorkspaceCommand';
import { resolveWorkersScope } from './project/BaseWorkerProject';

// This is a dirty hack to make TypeORM CLI not ask for -d (datasource) parameter
// We pass the datasource in using our own customizations to the TypeORM CLI.
// We have to do this here before we import yargs because that is where it parses the argv.
if (process.argv.includes('database')) {
    process.argv.push('-d', 'ignored_by_this');
}

// Help epilogue — one line, dimmed so it does not compete with the command list.
// The label matters: an unlabelled URL does not say what is on the other end.
const epilogue =
    '\x1b[90mDocumentation: https://base-framework.dev/documentation\x1b[0m';

void yargs(hideBin(process.argv))
    .usage('Usage: $0 <command> [options]')
    // Hidden — kept as a back-compat alias for the `[worker]` positional
    // that per-worker commands now declare. New docs/scripts use the
    // positional form (e.g. `base develop test-worker`).
    .option('worker', {
        alias: 'w',
        describe: 'The worker to run the command for.',
        global: true,
        type: 'string',
        hidden: true,
    })
    .option('environment', {
        alias: 'e',
        describe: 'The environment to run the command for.',
        global: true,
        type: 'string',
    })
    .option('workers-folder', {
        describe: 'The base folder to use for the workers.',
        global: true,
        type: 'string',
    })
    // Resolve workersFolder + worker once for every command, applying the
    // priority order: CLI flag > package.json base.workersFolder > CWD
    // detection (settings.ts / ./workers / CWD). Populates args so
    // command handlers see a single, consistent shape regardless of how
    // the user invoked `base`.
    //
    // `applyBeforeValidation: true` — must run before yargs checks
    // .demandOption('worker') on per-worker commands; otherwise the
    // CWD-inferred worker name lands too late to satisfy validation.
    .middleware((args) => {
        const cliFlag =
            typeof args.workersFolder === 'string' &&
            args.workersFolder.length > 0
                ? args.workersFolder
                : undefined;
        const cliWorker =
            typeof args.worker === 'string' && args.worker.length > 0
                ? args.worker
                : undefined;
        const scope = resolveWorkersScope(cliFlag, cliWorker);
        args.workersFolder = scope.workersFolder;
        if (scope.worker) args.worker = scope.worker;
    }, true)
    .command(new BundleCommand())
    .command(new CheckCommand())
    .command(new ContainerCommand())
    .command(new OrmCommand())
    .command(new DeployCommand())
    .command(new DevelopCommand())
    .command(new GqlCommand())
    .command(new InfoCommand())
    .command(new KeyGenCommand())
    .command(new TailCommand())
    .command(new TestCommand())
    .command(new WorkerCommand())
    .command(new WorkspaceCommand())
    .epilogue(epilogue)
    .recommendCommands()
    .demandCommand(1)
    .strict()
    .alias('v', 'version')
    .help('h')
    .alias('h', 'help').argv;
