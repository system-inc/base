// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import * as yargs from 'yargs';

import { DefaultConfigurationKey } from '@system-inc/base-common/configuration/NamedConfiguration';
import { EnvironmentVariables } from '@system-inc/base-foundation/configuration/EnvironmentVariables';
import { PlatformType } from '@system-inc/base-foundation/configuration/Platform';
import { Wrangler } from '../cloudflare/Wrangler';
import { CliArguments, CliPlatformType } from '../common/CliHelpers';
import { resolveProjectTsconfig } from '../common/ResolveProjectTsconfig';
import { Run } from '../common/Run';
import { CliEnvironmentVariables } from '../environment/CliEnvironmentVariables';
import { BaseWorkerProject } from '../project/BaseWorkerProject';
import { buildContainerDistIfPresent } from './ContainerCommand';

/**
 * Command for bundling a worker using esbuild.
 */
export class BundleCommand implements yargs.CommandModule {
    command = 'bundle [worker]';
    describe =
        'Compiles the workspace using tsc and bundles the worker specific using esbuild.';

    builder(args: yargs.Argv) {
        return args
            .positional('worker', {
                describe: 'Worker to bundle. Inferred from CWD if omitted.',
                type: 'string',
            })
            .option('bundler', {
                describe: 'The bundler to use.',
                type: 'string',
            })
            .option('minify', {
                describe: 'Minify the output.',
                type: 'boolean',
            })
            .option('tree-shake', {
                describe: 'Enable tree shaking.',
                type: 'boolean',
            })
            .option('analyze', {
                describe: 'Analyze the output.',
                type: 'boolean',
            })
            .option('expand', {
                describe: 'Expand the output to show all files.',
                type: 'boolean',
            })
            .option('watch', {
                describe: 'Watch for changes and rebuild.',
                type: 'boolean',
            })
            .option('meta', {
                describe: 'Meta information from esbuild.',
                type: 'boolean',
            })
            .implies('expand', 'analyze')
            .implies('meta', 'analyze')
            .demandOption('worker');
    }

    get handler(): (args: yargs.ArgumentsCamelCase) => void | Promise<void> {
        return async (args: yargs.Arguments) => {
            // Type-checking is the user's CI's job (`npm run build`).
            // esbuild itself catches syntax errors during the bundle.
            const workerProject = BaseWorkerProject.create(args);

            // Resolve the platform the same way `develop` does: start from the
            // CLI args, then let the worker's settings (server[runConfig].platform)
            // and finally the PLATFORM env var override it. The platform is what
            // decides which bundler we default to.
            // eslint-disable-next-line prefer-const
            let [platform, environment] =
                CliArguments.getPlatformAndEnvironment(args);

            const settingsModule =
                await workerProject.loadSettingsModule(environment);
            const serverSettings =
                settingsModule.settings.server?.[DefaultConfigurationKey];

            const [environmentVariables, wranglerEnvironmentVariables] =
                workerProject.loadEnvironmentVariables(environment);

            platform = CliPlatformType.resolvePlatform(
                platform,
                serverSettings,
                environmentVariables,
            );

            // Auto-select the bundler by platform unless the user forced one:
            //   Cloudflare → wrangler (the faithful deploy bundle)
            //   Node       → esbuild  (--platform=node)
            // --watch and --tree-shake only exist on the direct esbuild path, so
            // they force esbuild regardless of platform. --analyze/--meta/--expand
            // run against the faithful wrangler bundle via its --metafile, so they
            // no longer force the esbuild bundler.
            let bundler =
                typeof args.bundler === 'string'
                    ? args.bundler
                    : platform === PlatformType.Node
                      ? 'esbuild'
                      : 'wrangler';
            if (args.watch || args.treeShaking) {
                bundler = 'esbuild';
            }

            if (bundler === 'esbuild') {
                await bundleWorkerUsingEsBuild(workerProject, args, platform);
            } else {
                await bundleWorkerUsingWrangler(
                    args,
                    workerProject,
                    environment,
                    environmentVariables,
                    wranglerEnvironmentVariables,
                );
            }
        };
    }
}

export async function bundleWorkerUsingEsBuild(
    workerProject: BaseWorkerProject,
    args: yargs.Arguments,
    platform: PlatformType = PlatformType.CloudflareWorker,
) {
    const workerPath = workerProject.indexFile;

    // make sure the workerPath is a .ts or .js file
    if (!workerPath.endsWith('.ts') && !workerPath.endsWith('.js')) {
        console.log(`Error: worker path must be a .ts or .js file`);
        return;
    }
    const esBuildArgs = [
        `${workerPath}`,
        '--bundle',
        '--format=esm',
        `--outfile=${workerProject.buildFolder}/index.js`,
        '--sourcemap',
        '--log-limit=0',
    ];
    // Platform profile: a Node worker bundles for the node platform (so node
    // built-ins and conditional `exports` resolve correctly); a Cloudflare
    // worker keeps esbuild's default (browser-ish) resolution and leaves the
    // `cloudflare:workers` builtin external (added at the run call below).
    if (platform === PlatformType.Node) {
        esBuildArgs.push('--platform=node');
    }
    if (args.minify) {
        esBuildArgs.push('--minify');
        esBuildArgs.push('--keep-names');
    }
    if (args.treeShaking) {
        esBuildArgs.push('--tree-shaking=true');
    }
    if (args.analyze) {
        esBuildArgs.push('--analyze');
    }
    if (args.meta) {
        esBuildArgs.push(`--metafile=${workerProject.buildFolder}/meta.json`);
    }
    if (args.watch) {
        esBuildArgs.push('--watch');
    }

    // Pass the project tsconfig explicitly so esbuild applies experimentalDecorators
    // to the framework/module source in node_modules — its auto-discovery skips
    // node_modules (same fix as the wrangler path in Wrangler.ts).
    const projectTsconfig = resolveProjectTsconfig();
    if (projectTsconfig) {
        esBuildArgs.push(`--tsconfig=${projectTsconfig}`);
    }

    // `cloudflare:workers` is a Cloudflare-runtime builtin — keep it external on
    // that platform; on Node there's no such builtin to exclude.
    const platformExternals =
        platform === PlatformType.Node ? [] : ['--external:cloudflare:workers'];

    try {
        const output = await Run.program(
            resolveEsbuildBin(),
            [...esBuildArgs, ...platformExternals],
            {
                captureOutput: true,
            },
        );
        const expand = typeof args.expand === 'boolean' ? args.expand : false;
        printModuleSizes(output, args.worker as string, expand);
    } catch (error) {
        console.error('Error bundling worker with esbuild:', error);
        process.exit(1);
    }
}

/**
 * Resolve the esbuild binary via package.json + the `bin` field rather than a
 * hard-coded `./node_modules/.bin/esbuild` (which assumes CWD and isn't robust to
 * packages with restrictive `exports`). esbuild must be installed in the consumer
 * project for `--bundler esbuild` (the analysis/watch path).
 */
function resolveEsbuildBin(): string {
    try {
        const pkgJsonPath = require.resolve('esbuild/package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        const binRelative =
            typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.esbuild;
        if (!binRelative) {
            throw new Error('esbuild package.json has no `bin.esbuild` entry');
        }
        return path.join(path.dirname(pkgJsonPath), binRelative);
    } catch {
        throw new Error(
            "Could not resolve 'esbuild'. Install it in your project: " +
                '`npm install --save-dev esbuild`',
        );
    }
}

async function bundleWorkerUsingWrangler(
    args: yargs.Arguments,
    project: BaseWorkerProject,
    environment: string,
    environmentVariables: EnvironmentVariables,
    cliEnvironmentVariables: CliEnvironmentVariables,
) {
    await buildContainerDistIfPresent(project);

    const analyze = Boolean(args.analyze || args.expand || args.meta);
    const metafilePath = path.join(project.buildFolder, 'meta.json');

    try {
        await Wrangler.deploy(
            {
                ...args,
                // setup the wrangler deploy command to emit the bundle to the correct location
                // without actually deploying it, this is the only way to simulate the wrangler
                // build step without deploying the worker
                outdir: project.buildFolder,
                minify: args.minify || false,
                'dry-run': true,
                // emit esbuild's metafile so we can analyze the real deploy bundle
                ...(analyze ? { metafile: metafilePath } : {}),
            },
            project,
            environment,
            CliEnvironmentVariables.stringifyComplexVariables(
                environmentVariables,
            ),
            cliEnvironmentVariables,
        );
    } catch (error) {
        console.error('Error bundling worker with wrangler:', error);
        process.exit(1);
    }

    // Analyze the faithful deploy bundle from esbuild's metafile.
    if (analyze && fs.existsSync(metafilePath)) {
        const metafile = JSON.parse(
            fs.readFileSync(metafilePath, 'utf8'),
        ) as EsbuildMetafile;
        const expand = typeof args.expand === 'boolean' ? args.expand : false;
        printMetafileSizes(metafile, args.worker as string, expand);
    }
}

interface PackageFileContribution {
    path: string;
    sizeKb: number;
}

interface PackageInfo {
    totalSizeKb: number;
    files: PackageFileContribution[];
}

type PackageMap = Map<string, PackageInfo>;

function parseModuleSizes(
    input: string,
    worker: string,
): { packageMap: PackageMap; totalSizeKb: number } {
    const lines = input.split('\n');
    const packageMap: PackageMap = new Map();
    let totalSizeKb = 0;

    for (const line of lines) {
        const trimmed = line.trimStart().replace(/^├ /, '').replace(/^└ /, '');

        // Try to parse total size line
        const totalMatch = trimmed.match(/^workers\/.*\s+([\d.]+)(kb|mb)/i);
        if (totalMatch) {
            const sizeValue = parseFloat(totalMatch[1]);
            const unit = totalMatch[2].toLowerCase();
            if (unit === 'mb') {
                totalSizeKb += sizeValue * 1024;
            } else {
                totalSizeKb += sizeValue;
            }
            continue;
        }

        // Parse regular package lines
        const parts = trimmed.split(/\s+/);
        const path = parts[0];
        let sizeKb = 0;
        let sizePart = parts.find((part) => part.endsWith('kb'));
        if (sizePart) {
            sizeKb = parseFloat(sizePart.replace('kb', ''));
        } else {
            sizePart = parts.find((part) => part.endsWith('b'));
            if (sizePart) {
                sizeKb = parseFloat(sizePart.replace('b', '')) / 1024;
            }
        }

        if (isNaN(sizeKb)) {
            console.warn(
                `Could not parse size from line: "${line}". Skipping.`,
            );
            continue;
        }

        let packageName: string | null = null;

        if (path.startsWith('node_modules/')) {
            const modulePath = path.substring('node_modules/'.length);
            const pathSegments = modulePath.split('/');

            if (pathSegments[0].startsWith('@')) {
                packageName = pathSegments.slice(0, 2).join('/');
            } else {
                packageName = pathSegments[0];
            }
        } else if (path.startsWith('libraries/base/')) {
            packageName = 'base';
        } else {
            packageName = worker;
        }

        const existing = packageMap.get(packageName) ?? {
            totalSizeKb: 0,
            files: [],
        };

        existing.totalSizeKb += sizeKb;
        totalSizeKb += sizeKb;
        existing.files.push({ path, sizeKb });

        packageMap.set(packageName, existing);
    }

    // After parsing, sort each file list descending
    for (const pkgInfo of packageMap.values()) {
        pkgInfo.files.sort((a, b) => b.sizeKb - a.sizeKb);
    }

    return { packageMap, totalSizeKb };
}

export function printModuleSizes(
    rawOutput: string,
    worker: string,
    expand: boolean = false,
) {
    const { packageMap, totalSizeKb } = parseModuleSizes(rawOutput, worker);
    printPackageSizes(packageMap, totalSizeKb, worker, expand);
}

export function printMetafileSizes(
    metafile: EsbuildMetafile,
    worker: string,
    expand: boolean = false,
) {
    const { packageMap, totalSizeKb } = parseMetafileModuleSizes(
        metafile,
        worker,
    );
    printPackageSizes(packageMap, totalSizeKb, worker, expand);
}

function printPackageSizes(
    packageMap: PackageMap,
    totalSizeKb: number,
    worker: string,
    expand: boolean,
) {
    console.log('📊 Module Bundle Size Analysis:', totalSizeKb);

    if (packageMap.size === 0) {
        console.log('  (no module size data available)');
        return;
    }

    // Determine max package name length for padding
    const maxPackageLength = Math.max(
        ...Array.from(packageMap.keys()).map((name) => name.length),
    );

    console.log(); // blank line for spacing
    console.log('📦 Module Bundle Contributions:\n');

    for (const [packageName, packageInfo] of [...packageMap.entries()].sort(
        (a, b) => b[1].totalSizeKb - a[1].totalSizeKb,
    )) {
        const paddedName = packageName.padEnd(maxPackageLength, ' ');
        const coloredName =
            packageName === 'base'
                ? chalk.bgRed(paddedName)
                : packageName === worker
                  ? chalk.bgGreen(paddedName)
                  : chalk.yellow(paddedName);
        const sizeStr = `${packageInfo.totalSizeKb.toFixed(1)}`.padStart(8);
        const sizePrct = ((packageInfo.totalSizeKb / totalSizeKb) * 100)
            .toFixed(1)
            .padStart(5);
        console.log(
            `${coloredName}  ${chalk.cyan(sizeStr)} kb  ${chalk.magenta(sizePrct)} %`,
        );
        if (expand) {
            for (const file of packageInfo.files) {
                const fileSizeStr = `${file.sizeKb.toFixed(1)}`.padStart(8);
                console.log(
                    `  └─ ${chalk.cyan(fileSizeStr)} kb   ${chalk.gray(file.path)}`,
                );
            }
        }
    }

    console.log(); // blank line for spacing
}

/**
 * Minimal shape of esbuild's metafile (`--metafile`). The JS output's `inputs`
 * map gives each module's `bytesInOutput` contribution to the final bundle.
 */
interface EsbuildMetafile {
    outputs: Record<
        string,
        {
            bytes: number;
            entryPoint?: string;
            inputs?: Record<string, { bytesInOutput: number }>;
        }
    >;
}

function parseMetafileModuleSizes(
    metafile: EsbuildMetafile,
    worker: string,
): { packageMap: PackageMap; totalSizeKb: number } {
    const packageMap: PackageMap = new Map();
    let totalSizeKb = 0;

    // The bundle emits a .js output and a .js.map; analyze the code output.
    const jsOutput = Object.entries(metafile.outputs ?? {}).find(([file]) =>
        file.endsWith('.js'),
    )?.[1];
    const inputs = jsOutput?.inputs ?? {};

    for (const [inputPath, info] of Object.entries(inputs)) {
        const sizeKb = info.bytesInOutput / 1024;

        let packageName: string;
        const nmIndex = inputPath.lastIndexOf('node_modules/');
        if (nmIndex >= 0) {
            const modulePath = inputPath.substring(
                nmIndex + 'node_modules/'.length,
            );
            const segments = modulePath.split('/');
            packageName = segments[0].startsWith('@')
                ? segments.slice(0, 2).join('/')
                : segments[0];
        } else {
            packageName = worker;
        }

        const existing = packageMap.get(packageName) ?? {
            totalSizeKb: 0,
            files: [],
        };
        existing.totalSizeKb += sizeKb;
        existing.files.push({ path: inputPath, sizeKb });
        packageMap.set(packageName, existing);
        totalSizeKb += sizeKb;
    }

    for (const pkgInfo of packageMap.values()) {
        pkgInfo.files.sort((a, b) => b.sizeKb - a.sizeKb);
    }

    return { packageMap, totalSizeKb };
}
