// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as path from 'path';
import * as yargs from 'yargs';

import { EnvironmentType } from '@system-inc/base-foundation/configuration/Environment';
import { CliArguments, userCwd } from '../common/CliHelpers';
import {
    BaseWorkerProject,
    readWorkersFolderFromPackageJson,
} from '../project/BaseWorkerProject';

/**
 * `base info` — print the resolved worker/workersFolder/environment
 * context plus the resolution path that produced it. Useful when
 * something's loaded from a different place than you expect (the CWD
 * + package.json + CLI flag resolution has enough moving parts that
 * "where did it actually come from?" is a fair question).
 *
 * Read-only. No side effects.
 */
export class InfoCommand implements yargs.CommandModule {
    command = 'info [worker]';
    describe =
        'Print the resolved workspace/worker context and the resolution path.';

    builder(args: yargs.Argv) {
        return args
            .positional('worker', {
                describe: 'Worker to inspect. Inferred from CWD if omitted.',
                type: 'string',
            })
            .option('with-settings', {
                describe:
                    'Load settings.ts and list declared modules/databases. Slower; requires the worker to compile.',
                type: 'boolean',
                default: false,
            });
    }

    async handler(args: yargs.Arguments) {
        const [platform, environment] =
            CliArguments.getPlatformAndEnvironment(args);
        const cwd = userCwd();
        // After middleware, these are the resolved values. We re-derive
        // the trace separately so we can show *which* step matched.
        const resolvedWorkersFolder = args.workersFolder as string | undefined;
        const resolvedWorker = args.worker as string | undefined;

        const trace = traceResolution(args, cwd);

        printSection('Workspace');
        printRow('  workersFolder', resolvedWorkersFolder ?? '(unresolved)');
        printRow('  cwd', cwd);
        const matched = trace.find((step) => step.matched);
        if (matched) {
            printRow(
                '  resolved from',
                `${matched.description}${matched.detail ? ` (${matched.detail})` : ''}`,
            );
        }
        console.log();

        printSection('Worker');
        printRow('  name', resolvedWorker ?? '(none)');
        if (resolvedWorker && resolvedWorkersFolder) {
            const project = BaseWorkerProject.create(args);
            printRow('  workerFolder', project.workerFolder);
            printRow('  settings.ts', fileStatus(project.settingsFile));
            printRow('  wrangler.toml', fileStatus(project.wranglerConfigFile));
            printRow('  index.ts', fileStatus(project.indexFile));
        }
        console.log();

        printSection('Environment');
        printRow('  environment', environment);
        printRow('  platform', platform);
        printRow(
            '  default? ',
            args.environment === undefined
                ? `yes (no --environment passed; defaulted to ${EnvironmentType.Development})`
                : 'no',
        );
        console.log();

        printSection('Resolution path');
        for (let i = 0; i < trace.length; i++) {
            const step = trace[i];
            const marker = step.matched ? '✓' : step.checked ? '·' : ' ';
            console.log(
                `  ${i + 1}. ${marker} ${step.description}${
                    step.detail ? ` — ${step.detail}` : ''
                }`,
            );
        }
        console.log();

        if (args.withSettings && resolvedWorker && resolvedWorkersFolder) {
            await printSettingsInfo(args, environment);
        } else if (!args.withSettings) {
            console.log(
                '(Pass --with-settings to load settings.ts and list modules/databases.)',
            );
        }
    }
}

interface TraceStep {
    description: string;
    checked: boolean;
    matched: boolean;
    detail?: string;
}

function traceResolution(args: yargs.Arguments, cwd: string): TraceStep[] {
    const steps: TraceStep[] = [];
    const cwdIsWorker = fs.existsSync(path.join(cwd, 'settings.ts'));

    // For the trace, we re-examine the *original* CLI inputs (before
    // middleware overwrote them) by comparing the current args against
    // what we know the middleware would have done. The middleware sets
    // workersFolder unconditionally, so we infer the "did you pass a
    // flag?" question by checking if there's no package.json config
    // and no CWD signal. Imperfect but close enough for diagnostics.
    const configured = readWorkersFolderFromPackageJson(cwd);
    const cwdWorkers = path.join(cwd, 'workers');
    const cwdHasWorkersSubdir =
        fs.existsSync(cwdWorkers) && fs.statSync(cwdWorkers).isDirectory();

    // Step 1: --workersFolder flag. We can't trivially tell after-middleware
    // whether the user passed it, but we can tell the *resolved* path and
    // whether any later step also matched.
    const resolvedWorkersFolder = args.workersFolder as string | undefined;
    const flagLikelyMatched =
        resolvedWorkersFolder !== undefined &&
        !cwdIsWorker &&
        configured === undefined &&
        !cwdHasWorkersSubdir &&
        resolvedWorkersFolder !== cwd;
    steps.push({
        description: '--workersFolder flag',
        checked: true,
        matched: flagLikelyMatched,
        detail: flagLikelyMatched
            ? `set to ${resolvedWorkersFolder}`
            : undefined,
    });

    // Step 2: CWD has settings.ts
    steps.push({
        description: 'CWD itself is a worker (settings.ts present)',
        checked: true,
        matched: cwdIsWorker && !flagLikelyMatched,
        detail: cwdIsWorker ? `worker = ${path.basename(cwd)}` : 'not found',
    });

    // Step 3: package.json base.workersFolder
    steps.push({
        description: 'package.json `base.workersFolder` walking up from CWD',
        checked: !cwdIsWorker && !flagLikelyMatched,
        matched: !cwdIsWorker && !flagLikelyMatched && configured !== undefined,
        detail: configured
            ? `${configured.workersFolder} (from ${configured.packageRoot}/package.json)`
            : 'no `base.workersFolder` found',
    });

    // Step 4: CWD has ./workers/
    steps.push({
        description: 'CWD has `./workers/` subdirectory',
        checked: !cwdIsWorker && !flagLikelyMatched && configured === undefined,
        matched:
            !cwdIsWorker &&
            !flagLikelyMatched &&
            configured === undefined &&
            cwdHasWorkersSubdir,
        detail: cwdHasWorkersSubdir ? cwdWorkers : 'not present',
    });

    // Step 5: fallback to CWD
    steps.push({
        description: 'Fallback: CWD itself as workersFolder',
        checked:
            !cwdIsWorker &&
            !flagLikelyMatched &&
            configured === undefined &&
            !cwdHasWorkersSubdir,
        matched:
            !cwdIsWorker &&
            !flagLikelyMatched &&
            configured === undefined &&
            !cwdHasWorkersSubdir,
        detail: cwd,
    });

    return steps;
}

async function printSettingsInfo(
    args: yargs.Arguments,
    environment: string,
): Promise<void> {
    const project = BaseWorkerProject.create(args);
    let settingsModule;
    try {
        settingsModule = await project.loadSettingsModule(environment);
    } catch (error) {
        printSection('Settings (failed to load)');
        console.log(
            `  ${(error as Error).message || 'Unknown error loading settings.ts'}`,
        );
        return;
    }
    const settings = settingsModule.settings;

    printSection('Settings (loaded)');
    printRow('  worker name', settings.name);
    printRow('  worker version', settings.version);
    if (settings.title) printRow('  worker title', settings.title);
    console.log();

    if (settings.server) {
        printSection('Server config');
        for (const [key, value] of Object.entries(settings.server)) {
            if (!value) continue;
            const host = (value as { host?: string }).host;
            const port = (value as { port?: number }).port;
            printRow(`  ${key}`, `${host ?? 'localhost'}:${port ?? 8787}`);
        }
        console.log();
    }

    const modules = settings.modules ?? [];
    printSection('Modules');
    if (modules.length === 0) {
        console.log('  (none)');
    } else {
        for (const m of modules) {
            const name = (m as { name?: string }).name ?? '(unnamed)';
            console.log(`  - ${name}`);
        }
    }
    console.log();

    if (settings.orm) {
        printSection('Databases (ORM)');
        for (const [key, value] of Object.entries(settings.orm)) {
            if (!value) continue;
            const adapter = (value as { adapterType?: string }).adapterType;
            const dbType = (value as { databaseType?: unknown }).databaseType;
            const driver =
                typeof dbType === 'object' && dbType
                    ? (dbType as { driver?: string }).driver
                    : undefined;
            const dialect =
                typeof dbType === 'object' && dbType
                    ? (dbType as { dialect?: string }).dialect
                    : undefined;
            const summary = [adapter, driver, dialect]
                .filter(Boolean)
                .join(' / ');
            console.log(`  ${key}  ${summary}`);
        }
        console.log();
    }
}

function printSection(title: string): void {
    console.log(`${title}:`);
}

function printRow(label: string, value: string): void {
    console.log(`${label.padEnd(20)} ${value}`);
}

function fileStatus(filePath: string): string {
    return `${filePath} ${fs.existsSync(filePath) ? '✓' : '✗ (not found)'}`;
}
