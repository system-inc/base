// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as yargs from 'yargs';

import { PlatformType } from '@system-inc/base-foundation/configuration/Platform';
import { Wrangler } from '../cloudflare/Wrangler';
import { CliArguments } from '../common/CliHelpers';
import { BaseWorkerProject } from '../project/BaseWorkerProject';

export class TailCommand implements yargs.CommandModule {
    command = 'tail [worker]';
    describe = 'Tails the logs of a worker.';

    builder(args: yargs.Argv) {
        return args
            .positional('worker', {
                describe: 'Worker to tail. Inferred from CWD if omitted.',
                type: 'string',
            })
            .option('format', {
                describe: `The format of the log entries: 'json'|'pretty' optional`,
                type: 'string',
            })
            .option('status', {
                describe: `Filter by invocation status: 'ok'|'error'|'canceled'`,
                type: 'string',
            })
            .option('header', {
                describe: 'Filter by HTTP header.',
                type: 'string',
            })
            .option('method', {
                describe: 'Filter by HTTP method.',
                type: 'string',
            })
            .option('sampling-rate', {
                describe:
                    'Add a fraction of requests to log sampling rate (between 0 and 1).',
                type: 'number',
            })
            .option('search', {
                describe: 'Filter by a text match in console.log messages.',
                type: 'string',
            })
            .option('ip', {
                describe: `Filter by the IP address the request originates from. Use "self" to show only messages from your own IP.`,
                type: 'string',
            })
            .option('version-id', {
                describe: 'Filter by Worker version.',
                type: 'string',
            })
            .demandOption('worker');
    }

    get handler(): (args: yargs.ArgumentsCamelCase) => void | Promise<void> {
        return async (args: yargs.Arguments) => {
            const [platform, environment] =
                CliArguments.getPlatformAndEnvironment(args);
            const baseWorker = BaseWorkerProject.create(args);
            const [_environmentVariables, wranglerEnvironmentVariables] =
                baseWorker.loadEnvironmentVariables(environment);
            if (platform === PlatformType.CloudflareWorker) {
                try {
                    await Wrangler.tail(
                        args,
                        baseWorker,
                        wranglerEnvironmentVariables,
                    );
                } catch (error) {
                    process.exit(1);
                }
            } else {
                console.error(
                    `Error during tail: Unsupported platform ${platform}.`,
                );
                process.exit(1);
            }
        };
    }
}
