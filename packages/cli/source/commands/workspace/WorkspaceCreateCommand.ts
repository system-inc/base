// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as yargs from 'yargs';

import {
    copyTemplate,
    resolveCliPackageVersion,
    resolveTemplateDir,
} from '../../scaffold/CopyTemplate';

/**
 * `base workspace create [directory]` — scaffold a fresh base workspace.
 *
 * Lays down the workspace root files (package.json, tsconfig.json,
 * jest.config.js, etc.) plus a starter worker under `workers/<name>/`.
 * By default runs `npm install` so the project boots immediately.
 */
export class WorkspaceCreateCommand implements yargs.CommandModule {
    command = 'create [directory]';
    describe = 'Scaffold a fresh base workspace with a starter worker.';

    builder(args: yargs.Argv) {
        return args
            .positional('directory', {
                describe:
                    'Target directory for the new workspace. Created if missing. Defaults to the current directory.',
                type: 'string',
                default: '.',
            })
            .option('name', {
                describe:
                    'Workspace name written to package.json. Defaults to the basename of `directory`.',
                type: 'string',
            })
            .option('starter', {
                describe:
                    'Name of the starter worker to scaffold under `workers/`. Defaults to `app`.',
                type: 'string',
                default: 'app',
            })
            .option('port', {
                describe:
                    'Local dev port for the starter worker. Defaults to 3000.',
                type: 'number',
                default: 3000,
            })
            .option('install', {
                describe:
                    'Run `npm install` after scaffolding. Use --no-install to skip.',
                type: 'boolean',
                default: true,
            })
            .option('force', {
                describe:
                    'Overwrite existing files in the target directory. Use with care.',
                type: 'boolean',
                default: false,
            })
            .hide('worker')
            .hide('workersFolder')
            .hide('environment');
    }

    async handler(args: yargs.Arguments) {
        const targetDir = path.resolve(args.directory as string);
        const workspaceName =
            (args.name as string | undefined) ?? path.basename(targetDir);
        const starterName = args.starter as string;
        const port = args.port as number;
        const overwrite = args.force as boolean;
        const install = args.install as boolean;

        if (!isValidPackageName(workspaceName)) {
            console.error(
                `Workspace name '${workspaceName}' is not a valid npm package name. Pass a different --name or rename the target directory.`,
            );
            process.exit(1);
        }
        if (!isValidWorkerName(starterName)) {
            console.error(
                `Starter worker name '${starterName}' must be lowercase letters, digits, and hyphens.`,
            );
            process.exit(1);
        }

        console.log(`Creating base workspace in: ${targetDir}`);

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        } else if (!overwrite) {
            const existing = fs
                .readdirSync(targetDir)
                .filter((name) => name !== '.git');
            if (existing.length > 0) {
                console.error(
                    `Target directory is not empty: ${targetDir}. Use --force to scaffold anyway.`,
                );
                process.exit(1);
            }
        }

        const baseVersion = resolveCliPackageVersion();
        const workspaceVars = {
            workspaceName,
            workerName: starterName,
            workerPort: port,
            baseVersion,
        };
        const workerVars = {
            workspaceName,
            workerName: starterName,
            workerPort: port,
            baseVersion,
        };

        const writtenWorkspace = copyTemplate({
            templateDir: resolveTemplateDir('workspace'),
            targetDir,
            vars: workspaceVars,
            overwrite,
        });
        const workerDir = path.join(targetDir, 'workers', starterName);
        const writtenWorker = copyTemplate({
            templateDir: resolveTemplateDir('worker'),
            targetDir: workerDir,
            vars: workerVars,
            overwrite,
        });

        console.log(
            `✓ Wrote ${writtenWorkspace.length + writtenWorker.length} files (workspace + starter worker '${starterName}').`,
        );

        if (install) {
            console.log(`Installing dependencies (npm install)...`);
            const result = spawnSync('npm', ['install'], {
                cwd: targetDir,
                stdio: 'inherit',
                shell: process.platform === 'win32',
            });
            if (result.error || result.status !== 0) {
                console.error(
                    `npm install failed. Fix the error above and re-run \`npm install\` in ${targetDir}.`,
                );
                process.exit(result.status ?? 1);
            }
        } else {
            console.log(
                `Skipped npm install. Run \`npm install\` in ${targetDir} when ready.`,
            );
        }

        console.log('');
        console.log(`✅ Workspace ready at: ${targetDir}`);
        console.log('');
        console.log('Next:');
        console.log(`   cd ${path.relative(process.cwd(), targetDir) || '.'}`);
        console.log(
            `   git init && npm run prepare   # wires the pre-commit format hook`,
        );
        console.log(`   npm run base -- develop -w ${starterName}`);
    }
}

function isValidPackageName(name: string): boolean {
    return /^(?:@[a-z0-9-_.]+\/)?[a-z0-9-_.]+$/.test(name);
}

function isValidWorkerName(name: string): boolean {
    return /^[a-z][a-z0-9-]*$/.test(name);
}
