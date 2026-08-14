// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as path from 'path';
import type { Arguments } from 'yargs';

import { Mutable } from '@system-inc/base-common/type/UtilityTypes';
import { EnvironmentVariables } from '@system-inc/base-foundation/configuration/EnvironmentVariables';
import { ExecutionModeType } from '@system-inc/base-foundation/configuration/ExecutionMode';
import { resolveProjectTsconfig } from '../common/ResolveProjectTsconfig';
import { Run } from '../common/Run';
import {
    BaseWorkerProject,
    resolvePersistTo,
} from '../project/BaseWorkerProject';

export namespace Wrangler {
    export function dev(
        args: Arguments,
        worker: BaseWorkerProject,
        workerEnvironment: string,
        workerEnvironmentVariables: EnvironmentVariables,
        wranglerEnvironmentVariables: Record<string, string>,
    ): Promise<void> {
        return runDeployOrDev(
            'dev',
            args,
            worker,
            workerEnvironment,
            workerEnvironmentVariables,
            wranglerEnvironmentVariables,
        );
    }

    export function deploy(
        args: Arguments,
        worker: BaseWorkerProject,
        workerEnvironment: string,
        workerEnvironmentVariables: EnvironmentVariables,
        wranglerEnvironmentVariables: Record<string, string>,
    ): Promise<void> {
        return runDeployOrDev(
            'deploy',
            args,
            worker,
            workerEnvironment,
            workerEnvironmentVariables,
            wranglerEnvironmentVariables,
        );
    }

    export function tail(
        args: Arguments,
        worker: BaseWorkerProject,
        wranglerEnvironmentVariables: Record<string, string>,
    ): Promise<void> {
        // parse the command line options and translate them into the proper wrangler args
        const options: string[] = [];

        const argKeys = Object.keys(args);
        if (argKeys.includes('format')) {
            options.push('--format');
            options.push(args.format as string);
        }
        if (argKeys.includes('status')) {
            options.push('--status');
            options.push(args.status as string);
        }
        if (argKeys.includes('header')) {
            options.push('--header');
            options.push(args.header as string);
        }
        if (argKeys.includes('method')) {
            options.push('--method');
            options.push(args.method as string);
        }
        if (argKeys.includes('sampling-rate')) {
            options.push('--sampling-rate');
            options.push(args['sampling-rate'] as string);
        }
        if (argKeys.includes('search')) {
            options.push('--search');
            options.push(args.search as string);
        }
        if (argKeys.includes('ip')) {
            options.push('--ip');
            options.push(args.ip as string);
        }
        if (argKeys.includes('version-id')) {
            options.push('--version-id');
            options.push(args['version-id'] as string);
        }
        console.log('Tailing logs for worker', worker.worker);
        return Run.program(
            resolveWranglerBin(),
            ['tail', worker.worker, ...options],
            {
                env: {
                    ...process.env,
                    ...wranglerEnvironmentVariables,
                },
            },
        );
    }

    async function runDeployOrDev(
        command: 'dev' | 'deploy',
        args: Arguments,
        worker: BaseWorkerProject,
        workerEnvironment: string,
        workerEnvironmentVariables: EnvironmentVariables,
        wranglerEnvironmentVariables: Record<string, string>,
    ): Promise<void> {
        // parse the command line options and translate them into the proper wrangler args
        const options: string[] = [];

        const argKeys = Object.keys(args);
        // yargs boolean-negation turns `--no-bundle` into `bundle: false`
        // before option matching, so this is the only spelling that ever
        // reaches us — a declared 'no-bundle' option can never match.
        if (args.bundle === false) {
            options.push('--no-bundle');
        }
        // check dev only options
        if (command === 'dev') {
            if (argKeys.includes('remote')) {
                options.push('--remote');
            }
            if (argKeys.includes('port')) {
                options.push('--port');
                options.push(args.port as string);
            }
            if (argKeys.includes('inspector-port')) {
                options.push('--inspector-port');
                options.push(args['inspector-port'] as string);
            } else if (args.port) {
                options.push('--inspector-port');
                options.push((Number(args.port) + 10000).toString());
            }
            if (argKeys.includes('test-scheduled')) {
                console.log(
                    'TEST SCHEDULED: use "http://localhost:[PORT]/__scheduled?cron=*+*+*+*+*" to test.',
                );
                options.push('--test-scheduled');
            }
            if (argKeys.includes('local-protocol')) {
                options.push('--local-protocol');
                options.push(args['local-protocol'] as string);
            }
            if (argKeys.includes('https-cert-path')) {
                options.push('--https-cert-path');
                options.push(args['https-cert-path'] as string);
            }
            if (argKeys.includes('https-key-path')) {
                options.push('--https-key-path');
                options.push(args['https-key-path'] as string);
            }
            if (argKeys.includes('ip')) {
                options.push('--ip');
                options.push(args.ip as string);
            }
            // Shared local persistence (see resolvePersistTo): when a
            // `--persist-to` flag or workspace `base.persistTo` is set,
            // every worker's dev session stores miniflare state under the
            // same root, so same-database_id D1 bindings share one local
            // sqlite. Absolute path — wrangler resolves relative ones
            // against its own CWD (the worker folder).
            const persistTo = resolvePersistTo(args, worker.workerFolder);
            if (persistTo) {
                options.push('--persist-to');
                options.push(persistTo);
            }
        }
        // check deploy only options
        else if (command === 'deploy') {
            if (argKeys.includes('outdir')) {
                options.push('--outdir');
                options.push(args.outdir as string);
            }
            if (
                (argKeys.includes('dry-run') && args['dry-run']) ||
                (argKeys.includes('dryRun') && args['dryRun'])
            ) {
                options.push('--dry-run');
            }
            // Value test, not presence: bundleWorkerUsingWrangler always
            // passes the key (`minify: args.minify || false`), so keying on
            // presence forced --minify on every dry-run bundle.
            if (argKeys.includes('minify') && args.minify) {
                options.push('--minify');
            }
            // Emit esbuild's build metadata so `base bundle --analyze/--meta` can
            // analyze the FAITHFUL deploy bundle (not a separate direct-esbuild run).
            if (argKeys.includes('metafile') && args.metafile) {
                options.push('--metafile');
                options.push(args.metafile as string);
            }
        }

        // wrangler bundles with esbuild, which only applies experimentalDecorators
        // to node_modules source when handed an EXPLICIT tsconfig (its auto-discovery
        // skips node_modules). The framework — and modules — ship decorator-based
        // source into node_modules, so pass the project's tsconfig explicitly;
        // without it the worker fails to build with "Parameter decorators only work
        // when experimental decorators are enabled".
        const projectTsconfig = resolveProjectTsconfig();
        if (projectTsconfig) {
            options.push('--tsconfig', projectTsconfig);
        }

        const mutableEnv: Mutable<EnvironmentVariables> =
            workerEnvironmentVariables;
        if (!workerEnvironmentVariables.BUILD_TIMESTAMP) {
            mutableEnv.BUILD_TIMESTAMP = new Date().toISOString();
        }
        // git metadata is best-effort and optional — only set when available,
        // left unset in a freshly scaffolded project with no git history.
        if (!workerEnvironmentVariables.COMMIT_SHA) {
            const commitSha = await getCommitSha();
            if (commitSha) mutableEnv.COMMIT_SHA = commitSha;
        }
        if (!workerEnvironmentVariables.DEPLOYED_BY) {
            const deployedBy = await getGitHuser();
            if (deployedBy) mutableEnv.DEPLOYED_BY = deployedBy;
        }
        if (!workerEnvironmentVariables.ENVIRONMENT) {
            mutableEnv.ENVIRONMENT = workerEnvironment;
        }
        if (command === 'dev' && !workerEnvironmentVariables.EXECUTION_MODE) {
            mutableEnv.EXECUTION_MODE = ExecutionModeType.Local;
        }

        const environmentVariablesStrings = [];
        for (const key in workerEnvironmentVariables) {
            environmentVariablesStrings.push(
                `${key}:${workerEnvironmentVariables[key]}`,
            );
        }

        console.log(
            'Running wrangler',
            command,
            'for',
            worker.worker,
            'at',
            worker.indexFile,
            'with',
            options,
        );

        return Run.program(
            resolveWranglerBin(),
            [
                command,
                worker.indexFile,
                ...options,
                '--config',
                worker.wranglerConfigFile,
                '--env',
                workerEnvironment,
                '--var',
                ...environmentVariablesStrings,
            ],
            {
                env: {
                    ...process.env,
                    ...wranglerEnvironmentVariables,
                },
            },
        );
    }
}

/**
 * Resolve the wrangler binary via Node's module resolution rather than
 * hard-coding `./node_modules/.bin/wrangler` relative to CWD. Lets the CLI
 * work from any directory as long as wrangler is reachable up the
 * node_modules tree from where @system-inc/base-cli is installed.
 */
export function resolveWranglerBin(): string {
    try {
        // Resolve via package.json + the `bin` field rather than a hard-coded
        // subpath. Newer wrangler ships an `exports` map that does NOT expose
        // `./bin/wrangler.js`, so `require.resolve('wrangler/bin/wrangler.js')`
        // throws ERR_PACKAGE_PATH_NOT_EXPORTED. `./package.json` is always
        // resolvable regardless of `exports`.
        const pkgJsonPath = require.resolve('wrangler/package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        const binRelative =
            typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.wrangler;
        if (!binRelative) {
            throw new Error(
                'wrangler package.json has no `bin.wrangler` entry',
            );
        }
        return path.join(path.dirname(pkgJsonPath), binRelative);
    } catch {
        throw new Error(
            "Could not resolve 'wrangler'. Install it in your project: " +
                '`npm install --save-dev wrangler`',
        );
    }
}

async function getCommitSha(): Promise<string | undefined> {
    try {
        const result = await Run.program('git', ['rev-parse', 'HEAD'], {
            captureOutput: true,
            silent: true,
        });
        const sha = result.trim();
        // A dirty tree means HEAD doesn't describe what's actually being
        // shipped — mark the SHA so the deployed metadata stays honest.
        // (Deploying dirty to Production requires --allow-dirty; see
        // DeployGates.enforceCleanGitTree.)
        const status = await Run.program('git', ['status', '--porcelain'], {
            captureOutput: true,
            silent: true,
        });
        return status.trim().length > 0 ? `${sha}-dirty` : sha;
    } catch {
        // Not a git repo, or no commits yet (e.g. a freshly scaffolded project).
        // Metadata is best-effort and optional — leave COMMIT_SHA unset.
        return undefined;
    }
}

async function getGitHuser(): Promise<string | undefined> {
    const isCI = process.env.GITHUB_ACTIONS === 'true';
    if (isCI) {
        const actor = process.env.GITHUB_ACTOR || 'unknown';
        return `gh-actions[${actor}]`;
    }
    try {
        const userName = await Run.program('git', ['config', 'user.name'], {
            captureOutput: true,
            silent: true,
        });
        const userEmail = await Run.program('git', ['config', 'user.email'], {
            captureOutput: true,
            silent: true,
        });
        return `${userName.trim()} <${userEmail.trim()}>`;
    } catch {
        // No git / no user configured — leave DEPLOYED_BY unset.
        return undefined;
    }
}
