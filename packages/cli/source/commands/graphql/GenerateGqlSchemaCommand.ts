// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as yargs from 'yargs';

import { BaseProvider } from '../../common/BaseProvider';
import { resetBaseGlobalState } from '../../project/BaseWorkerProject';
import { getWorkspaceWorkers } from '../workspace/WorkspaceCommand';
import { generateGqlSchema } from './GqlCommandHandlers';

/**
 * Command for GraphQL generating a GraphQL schema from a worker.
 */
export class GenerateGqlSchemaCommand implements yargs.CommandModule {
    command = 'schema:generate [worker]';
    describe =
        'Generates the GraphQL schema and outputs it to the given location.';

    get builder(): yargs.CommandBuilder | undefined {
        return (args: yargs.Argv) => {
            return args
                .positional('worker', {
                    describe:
                        'Worker to generate schema for. Inferred from CWD if omitted. Use --all-workers to fan out.',
                    type: 'string',
                })
                .option('all-workers', {
                    describe:
                        'Generate schemas for every worker in the workspace. Workers without GraphQL configured are skipped with a message.',
                    type: 'boolean',
                })
                .option('path', {
                    alias: 'p',
                    describe: 'The file path to emit the schema at.',
                    type: 'string',
                })
                .option('split-schema', {
                    alias: 's',
                    describe:
                        'Whether or not to split the schema into multiple files.',
                    type: 'boolean',
                })
                .option('metadata', {
                    alias: 'm',
                    describe: 'Emits additional metadata about the schema.',
                    type: 'boolean',
                })
                .conflicts('all-workers', 'worker');
        };
    }

    get handler(): (args: yargs.ArgumentsCamelCase) => void | Promise<void> {
        return async (args: yargs.Arguments) => {
            const generateOptions = {
                filePath: args.path as string,
                byModule: args.splitSchema as boolean,
                emitMetadata: args.metadata as boolean,
            };

            if (args.allWorkers === true) {
                const workers = getWorkspaceWorkers(args);
                for (const worker of workers) {
                    console.log(`Generating schema for worker: ${worker}`);
                    try {
                        await generateGqlSchema(
                            new BaseProvider({ ...args, worker }),
                            generateOptions,
                        );
                    } catch (error) {
                        console.log(
                            'GraphQL not configured for worker: ' + worker,
                        );
                    }
                    // Decorator metadata accumulates across iterations
                    // — reset so the next worker's settings.ts load
                    // doesn't trip over duplicate registrations.
                    resetBaseGlobalState();
                }
                console.log('GraphQL schema generation complete!');
                return;
            }

            if (typeof args.worker !== 'string' || args.worker.length === 0) {
                console.error(
                    'No worker specified. Pass [worker], run from inside a worker folder, or pass --all-workers.',
                );
                process.exit(1);
            }

            console.log(`Generating schema for worker: ${args.worker}`);
            await generateGqlSchema(new BaseProvider(args), generateOptions);
        };
    }
}
