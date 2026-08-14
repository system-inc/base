// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as path from 'path';
import type { Arguments } from 'yargs';

import { getGlobalVariable } from '@system-inc/base-common/global/Global';
import { Dictionary } from '@system-inc/base-common/type/Dictionary';
import {
    BaseSettings,
    isBaseSettings,
} from '@system-inc/base-foundation/base/BaseSettings';
import { EnvironmentVariables } from '@system-inc/base-foundation/configuration/EnvironmentVariables';
import { userCwd } from '../common/CliHelpers';
import { CliEnvironmentVariables } from '../environment/CliEnvironmentVariables';
import { Toml } from '../toml/Toml';

export interface BaseSettingsModule {
    name: string;
    settings: BaseSettings;
}

/**
 * Abstraction for the files and folders of a worker in the file system.
 */
export class BaseWorkerProject {
    /**
     * Creates a new BaseWorkerProject instance from the command line arguments.
     *
     * @param argsOrWorker
     * @returns
     */
    /**
     * Resolve the project's `workersFolder` (parent dir holding all workers)
     * and the target `worker` from CLI args, project config, and CWD.
     *
     * Resolution order for `workersFolder`:
     *   1. `--workersFolder <path>` CLI flag — explicit override.
     *   2. CWD itself is a worker (has `settings.ts`) → workersFolder is
     *      `parent(CWD)`. Sitting inside a worker is a strong signal
     *      that beats a project-level default.
     *   3. `package.json` → `"base"` → `"workersFolder"` walking up from
     *      CWD (project-level config; the base repo points at `./examples`).
     *   4. CWD has `./workers/` subdir → that's the workersFolder.
     *   5. Otherwise → CWD itself is the workersFolder.
     *
     * Resolution order for `worker`:
     *   1. `-w <name>` CLI flag (always wins).
     *   2. Inferred as `basename(CWD)` when CWD has `settings.ts`.
     *   3. Otherwise undefined; per-worker commands exit with an error.
     */
    static create(argsOrWorker: Arguments | string): BaseWorkerProject {
        const args =
            typeof argsOrWorker === 'string'
                ? ({ worker: argsOrWorker } as unknown as Arguments)
                : argsOrWorker;

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

        if (!scope.worker) {
            console.error(
                'No worker specified. Pass `-w <name>` or run from inside a worker folder (one that contains `settings.ts`).',
            );
            process.exit(1);
        }

        // Keep legacy code paths that read this env var working.
        process.env.WORKERS_FOLDER = scope.workersFolder;

        return new BaseWorkerProject(scope.worker, scope.workersFolder);
    }

    readonly worker: string;
    private readonly workersFolder: string;

    private constructor(worker: string, workersFolder: string) {
        this.worker = worker;
        this.workersFolder = workersFolder;
    }

    /**
     * The workersFolder path relative to the current CWD. Returns `'.'`
     * when CWD already is the workersFolder.
     */
    get relativeWorkersFolder(): string {
        const rel = path.relative(process.cwd(), this.workersFolder);
        return rel.length > 0 ? rel : '.';
    }

    get workerFolder(): string {
        return this.workersFolder + '/' + this.worker;
    }

    get globalEnvFile(): string {
        return `${this.workersFolder}/env.toml`;
    }

    get indexFile(): string {
        return this.workerFolder + '/index.ts';
    }

    get settingsFile(): string {
        return this.workerFolder + '/settings.ts';
    }

    get workerEnvFile(): string {
        return this.workerFolder + '/env.toml';
    }

    get wranglerConfigFile(): string {
        return this.workerFolder + '/wrangler.toml';
    }

    get buildFolder(): string {
        return this.workerFolder + '/build';
    }

    // ── Container ───────────────────────────────────────────────────────

    get containerFolder(): string {
        return this.workerFolder + '/container';
    }

    get containerIndexFile(): string {
        return this.containerFolder + '/index.ts';
    }

    get containerSettingsFile(): string {
        return this.containerFolder + '/settings.ts';
    }

    get containerDistFolder(): string {
        return this.containerFolder + '/dist';
    }

    /**
     * Removes the container dist folder so stale artifacts don't persist.
     */
    cleanContainerDist(): void {
        if (fs.existsSync(this.containerDistFolder)) {
            console.log(`Cleaning ${this.containerDistFolder}`);
            fs.rmSync(this.containerDistFolder, { recursive: true });
        }
    }

    /**
     * Returns true if the container folder contains a base worker
     * (has both an index.ts and settings.ts).
     */
    get hasContainerWorker(): boolean {
        return (
            fs.existsSync(this.containerIndexFile) &&
            fs.existsSync(this.containerSettingsFile)
        );
    }

    /**
     * Loads the container settings.ts and returns the worker name.
     * Validates that the name matches the container's package.json if present.
     */
    async loadContainerName(): Promise<string> {
        const settingsModule = await import(this.containerSettingsFile);
        const exportedSettings = Object.keys(settingsModule).filter((key) =>
            isBaseSettings(settingsModule[key]),
        );
        if (exportedSettings.length !== 1) {
            throw new Error(
                `Expected exactly one BaseSettings export in ${this.containerSettingsFile}, found: ${exportedSettings.join(', ')}`,
            );
        }
        const containerName = (
            settingsModule[exportedSettings[0]] as BaseSettings
        ).name;

        // validate against package.json if it exists
        const packageJsonPath = this.containerFolder + '/package.json';
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(
                fs.readFileSync(packageJsonPath, 'utf8'),
            );
            if (packageJson.name && packageJson.name !== containerName) {
                throw new Error(
                    `Container name mismatch: settings.ts has '${containerName}' but package.json has '${packageJson.name}'`,
                );
            }
        }

        return containerName;
    }

    /**
     * Returns the dependency names from the container's package.json,
     * to be used as esbuild externals (native modules installed in Docker).
     */
    get containerExternals(): string[] {
        const packageJsonPath = this.containerFolder + '/package.json';
        if (!fs.existsSync(packageJsonPath)) {
            return [];
        }
        const packageJson = JSON.parse(
            fs.readFileSync(packageJsonPath, 'utf8'),
        );
        return Object.keys(packageJson.dependencies ?? {});
    }

    get graphqlFolder(): string {
        return this.workerFolder + '/graphql';
    }

    get graphqlSchemaFolder(): string {
        return this.graphqlFolder + '/schemas';
    }

    private _settingsModule: BaseSettingsModule | null = null;

    /**
     * Loads the settings file from the arguments.
     *
     * @param argv The arguments to load the settings file from.
     * @returns The loaded settings file.
     */
    async loadSettingsModule(
        _environment: string,
    ): Promise<BaseSettingsModule> {
        if (this._settingsModule) {
            return this._settingsModule;
        }

        // make sure the settings file exists in the worker folder
        if (!fs.existsSync(this.settingsFile)) {
            console.error(
                `No settings file found for '${this.worker}' (${this.settingsFile})`,
            );
            process.exit(1);
        }

        const settingsModule = await import(this.settingsFile);

        // look for an object that has the required fields of the BaseSettings interface
        const exportedSettings = Object.keys(settingsModule).filter((key) =>
            isBaseSettings(settingsModule[key]),
        );
        if (exportedSettings.length === 0 || exportedSettings.length > 1) {
            throw new Error(
                `Expected exactly one BaseSettings export in ${this.settingsFile}, found: ${exportedSettings.join(', ')}`,
            );
        }
        const settingsName = exportedSettings[0];
        this._settingsModule = {
            name: settingsName,
            settings: settingsModule[settingsName] as BaseSettings,
        };

        return this._settingsModule;
    }

    /**
     * Gets the Base environment variables from the process arguments.
     *
     * @param argv The arguments to load the environment file from.
     * @returns The created environment.
     */
    loadEnvironmentVariables(
        environment: string,
        defaultEnv?: Dictionary<string | undefined>,
    ): [EnvironmentVariables, CliEnvironmentVariables] {
        let environmentVariables: Dictionary<string | undefined> = {};
        // start by loading any default environment variables
        if (defaultEnv) {
            environmentVariables = {
                ...defaultEnv,
                ENVIRONMENT: environment,
            };
        }
        let envFound = false;

        // now load any environment variables from the wrangler.toml file
        if (fs.existsSync(this.wranglerConfigFile)) {
            const wranglerContent = fs.readFileSync(
                this.wranglerConfigFile,
                'utf8',
            );
            const config = Toml.parseToml(
                this.wranglerConfigFile,
                wranglerContent,
            );
            // load any environment variables for the current environment
            if (config?.env?.[environment]?.vars) {
                envFound = true;
                environmentVariables = {
                    ...environmentVariables,
                    ...config.env[environment].vars,
                };
            }
        }

        // next overlay any global environment variables
        if (fs.existsSync(this.globalEnvFile)) {
            const globalEnvContent = fs.readFileSync(
                this.globalEnvFile,
                'utf8',
            );
            const globalEnv = Toml.parseToml(
                this.globalEnvFile,
                globalEnvContent,
            );
            if (globalEnv?.[environment]) {
                envFound = true;
                environmentVariables = {
                    ...environmentVariables,
                    ...globalEnv[environment],
                };
            }
        }

        // finally overlay any worker specific environment variables
        if (fs.existsSync(this.workerEnvFile)) {
            const workerEnvContent = fs.readFileSync(
                this.workerEnvFile,
                'utf8',
            );
            const workerEnv = Toml.parseToml(
                this.workerEnvFile,
                workerEnvContent,
            );
            if (workerEnv?.[environment]) {
                envFound = true;
                environmentVariables = {
                    ...environmentVariables,
                    ...workerEnv[environment],
                };
            }
        }

        // A worker with no variables for this environment is valid — don't force
        // an env.toml just to pass. Warn (so a typo'd environment name is still
        // visible) and proceed with whatever was collected, possibly nothing.
        // Checks that genuinely need config (e.g. ORM needing DATABASES) fail on
        // their own, specifically, downstream.
        if (!envFound) {
            console.warn(
                `No environment config found for '${environment}' on worker '${this.worker}'; proceeding with no environment variables.`,
            );
        }

        // remove the wrangler specific environment variables
        const cliEnvironmentVariables: Dictionary<string | undefined> = {};
        for (const key of CliEnvironmentVariables.Keys) {
            if (environmentVariables[key]) {
                cliEnvironmentVariables[key] = environmentVariables[key];
                delete environmentVariables[key];
            }
        }

        return [
            environmentVariables as EnvironmentVariables,
            cliEnvironmentVariables as CliEnvironmentVariables,
        ];
    }
}

/**
 * Resets the global state of the Base application.
 * Removes all metadata and resets the global variable.
 * Prepares for a new Base instance to be created.
 */
export function resetBaseGlobalState() {
    // reset the global state
    console.log('Resetting global state ...');
    const globalVariable = getGlobalVariable();
    globalVariable.BaseMetadata = undefined;
}

export interface WorkersScope {
    /** Absolute path to the workersFolder. */
    workersFolder: string;
    /** Resolved worker name, or undefined if neither CLI nor CWD-detection set one. */
    worker: string | undefined;
}

/**
 * Implements the resolution order documented on `BaseWorkerProject.create`.
 * Pure path computation — no side effects. Exported so the top-level
 * yargs middleware can populate args.worker/args.workersFolder before
 * any command handler runs, keeping per-command logic uniform.
 */
export function resolveWorkersScope(
    cliFlag: string | undefined,
    cliWorker: string | undefined,
): WorkersScope {
    const cwd = userCwd();
    const cwdIsWorker = fs.existsSync(path.join(cwd, 'settings.ts'));

    // 1. CLI --workersFolder flag — explicit override beats everything.
    if (cliFlag) {
        return {
            workersFolder: path.resolve(cwd, cliFlag),
            worker: cliWorker ?? (cwdIsWorker ? path.basename(cwd) : undefined),
        };
    }

    // 2. CWD itself is a worker — strongest CWD signal, beats the
    //    project-level default. Lets a developer `cd worker/foo` and
    //    work uninterrupted, even in a repo whose package.json points
    //    at a different default workersFolder.
    if (cwdIsWorker) {
        return {
            workersFolder: path.dirname(cwd),
            worker: cliWorker ?? path.basename(cwd),
        };
    }

    // 3. package.json `"base": { "workersFolder": "..." }` walking up
    //    from CWD. Lets a project (e.g. the base repo) point at a
    //    non-default folder (e.g. `./examples`) once instead of per-command.
    const configured = readWorkersFolderFromPackageJson(cwd);
    if (configured) {
        return {
            workersFolder: path.resolve(
                configured.packageRoot,
                configured.workersFolder,
            ),
            worker: cliWorker,
        };
    }

    // 4. CWD has a `./workers/` subdir — the conventional layout.
    const cwdWorkers = path.join(cwd, 'workers');
    if (fs.existsSync(cwdWorkers) && fs.statSync(cwdWorkers).isDirectory()) {
        return { workersFolder: cwdWorkers, worker: cliWorker };
    }

    // 5. Fallback — CWD itself is the workersFolder.
    return { workersFolder: cwd, worker: cliWorker };
}

/**
 * Walk up from `startDir` looking for the nearest `package.json` that
 * declares the given string key under `"base"`. Returns the configured
 * value together with the directory of the package.json (used to resolve
 * a relative path consistently with how npm scripts would resolve it).
 */
function readBaseKeyFromPackageJson(
    startDir: string,
    key: string,
): { value: string; packageRoot: string } | undefined {
    let dir = startDir;
    while (true) {
        const pjPath = path.join(dir, 'package.json');
        if (fs.existsSync(pjPath)) {
            try {
                const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
                const value = pj?.base?.[key];
                if (typeof value === 'string' && value.length > 0) {
                    return { value, packageRoot: dir };
                }
            } catch {
                // Unparseable package.json — ignore and keep walking.
            }
        }
        const parent = path.dirname(dir);
        if (parent === dir) return undefined; // reached filesystem root
        dir = parent;
    }
}

/**
 * Walk up from `startDir` looking for the nearest `package.json` that
 * declares `base.workersFolder`. Returns the configured path together
 * with the directory of the package.json (used to resolve a relative
 * `workersFolder` consistently with how npm scripts would resolve it).
 */
export function readWorkersFolderFromPackageJson(
    startDir: string,
): { workersFolder: string; packageRoot: string } | undefined {
    const found = readBaseKeyFromPackageJson(startDir, 'workersFolder');
    return found
        ? { workersFolder: found.value, packageRoot: found.packageRoot }
        : undefined;
}

/**
 * Resolve the local-persistence root passed to wrangler as `--persist-to`
 * for commands that touch local state (`develop`, `orm migration:run
 * --local`, `orm db:reset`). Precedence:
 *
 *   1. `--persist-to` CLI flag — resolved against CWD.
 *   2. `package.json` → `"base"` → `"persistTo"` walking up from the
 *      worker folder — resolved against that package.json's directory.
 *   3. `undefined` — wrangler's default: a private `.wrangler/state`
 *      inside the worker folder.
 *
 * Declaring a workspace-level `persistTo` gives every worker the same
 * persistence root. Miniflare keys local D1 state by `database_id`, so
 * workers that bind the same database in wrangler.toml then share one
 * local sqlite — matching how they share the real database when
 * deployed — instead of each holding a private copy.
 */
export function resolvePersistTo(
    args: Arguments,
    workerFolder: string,
): string | undefined {
    const flag = args['persist-to'] ?? args.persistTo;
    if (typeof flag === 'string' && flag.length > 0) {
        return path.resolve(userCwd(), flag);
    }
    const configured = readBaseKeyFromPackageJson(workerFolder, 'persistTo');
    if (configured) {
        return path.resolve(configured.packageRoot, configured.value);
    }
    return undefined;
}
