// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as path from 'path';
import * as yargs from 'yargs';

import { userCwd } from '../../common/CliHelpers';
import { copyTemplate, resolveTemplateDir } from '../../scaffold/CopyTemplate';

/**
 * `base worker create <name>` — scaffold a new worker into the
 * current workspace. Uses the workspace's resolved workersFolder (CLI
 * flag > package.json `base.workersFolder` > `./workers` > CWD).
 */
export class WorkerCreateCommand implements yargs.CommandModule {
    command = 'create <worker>';
    describe = 'Scaffold a new worker into the current workspace.';

    builder(args: yargs.Argv) {
        return args
            .positional('worker', {
                describe: 'Name of the new worker to scaffold.',
                type: 'string',
            })
            .option('port', {
                describe:
                    'Local dev port for the new worker. Defaults to 3000.',
                type: 'number',
                default: 3000,
            })
            .option('force', {
                describe:
                    'Overwrite existing files in the worker directory. Use with care.',
                type: 'boolean',
                default: false,
            });
    }

    async handler(args: yargs.Arguments) {
        const workerName = args.worker as string;
        const workersFolder = args.workersFolder as string;
        const port = args.port as number;
        const overwrite = args.force as boolean;

        if (!isValidWorkerName(workerName)) {
            console.error(
                `Worker name '${workerName}' must be lowercase letters, digits, and hyphens.`,
            );
            process.exit(1);
        }

        const workerDir = path.join(workersFolder, workerName);

        if (fs.existsSync(workerDir) && !overwrite) {
            console.error(
                `Worker directory already exists: ${workerDir}. Use --force to overwrite.`,
            );
            process.exit(1);
        }

        console.log(`Creating worker '${workerName}' in: ${workerDir}`);
        const written = copyTemplate({
            templateDir: resolveTemplateDir('worker'),
            targetDir: workerDir,
            vars: {
                workerName,
                workerPort: port,
            },
            overwrite,
        });

        console.log(`✓ Wrote ${written.length} files.`);
        console.log('');
        console.log('Next:');
        const rel = path.relative(userCwd(), workerDir) || '.';
        console.log(`   cd ${rel}`);
        console.log(`   npx base develop`);
    }
}

function isValidWorkerName(name: string): boolean {
    return /^[a-z][a-z0-9-]*$/.test(name);
}
