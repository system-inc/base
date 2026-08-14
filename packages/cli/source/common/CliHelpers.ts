// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as yargs from 'yargs';

import { BaseServerSettings } from '@system-inc/base-foundation/base/BaseServerSettings';
import { EnvironmentType } from '@system-inc/base-foundation/configuration/Environment';
import { EnvironmentVariables } from '@system-inc/base-foundation/configuration/EnvironmentVariables';
import { PlatformType } from '@system-inc/base-foundation/configuration/Platform';

export namespace CliArguments {
    export function getPlatformAndEnvironment(
        args: yargs.ArgumentsCamelCase,
        required: boolean = false,
    ): [PlatformType, string] {
        const argKeys = Object.keys(args);

        let platform: PlatformType = PlatformType.CloudflareWorker;
        if (argKeys.includes('platform')) {
            platform = CliPlatformType.getPlatformTypeFromArgumentString(
                args.platform as string,
            );
        } else if (required) {
            console.error('No platform specified');
            process.exit(1);
        }

        let environment: string = EnvironmentType.Development;
        if (typeof args.environment === 'string') {
            environment = args.environment;
        } else if (required) {
            console.error('No environment specified');
            process.exit(1);
        }

        return [platform, environment];
    }
}

/**
 * The directory the user actually invoked `base` from, before `npx`
 * helpfully changed CWD to the nearest workspace root. `npm` and `npx`
 * set `INIT_CWD` to the user's original CWD; we fall back to
 * `process.cwd()` if it isn't set (e.g. when running the bin directly
 * via `node ./packages/cli/dist/base-cli.js`).
 *
 * Use this anywhere user-provided paths (e.g. `--files`, `--workersFolder`)
 * need to be resolved relative to "where the user was standing."
 */
export function userCwd(): string {
    return process.env.INIT_CWD || process.cwd();
}

export namespace CliPlatformType {
    export function getPlatformTypeFromArgumentString(
        arg: string,
    ): PlatformType {
        switch (arg.toLowerCase()) {
            case 'cloudflare':
            case 'cloudflare-worker':
                return PlatformType.CloudflareWorker;
            case 'node':
                return PlatformType.Node;
            // currently we don't support running as a durable object
            default:
                throw new Error(`Unknown platform type: ${arg}`);
        }
    }

    /**
     * Resolve the effective platform for a worker invocation, applying the
     * standard precedence: the CLI args (`initial`) are overridden by the
     * worker's `server[runConfig].platform` setting, which is in turn
     * overridden by the `PLATFORM` environment variable. Shared by `develop`
     * and `bundle` so they select the same toolchain for a given worker.
     */
    export function resolvePlatform(
        initial: PlatformType,
        serverSettings: BaseServerSettings | undefined,
        environmentVariables: EnvironmentVariables,
    ): PlatformType {
        let platform = initial;
        if (serverSettings?.platform === 'node') {
            platform = PlatformType.Node;
        } else if (serverSettings?.platform === 'cloudflare') {
            platform = PlatformType.CloudflareWorker;
        }
        if (environmentVariables.PLATFORM) {
            platform = getPlatformTypeFromArgumentString(
                environmentVariables.PLATFORM,
            );
        }
        return platform;
    }
}
