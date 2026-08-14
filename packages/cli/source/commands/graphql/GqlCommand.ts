// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as yargs from 'yargs';

import { CheckGqlSchemaCommand } from './CheckGqlSchemaCommand';
import { GenerateGqlSchemaCommand } from './GenerateGqlSchemaCommand';

/**
 * Command for GraphQL related configuration of Base.
 */
export class GqlCommand implements yargs.CommandModule {
    command = 'graphql <command>';
    describe = 'Performs specific GraphQL operations.';

    get builder(): yargs.CommandBuilder | undefined {
        return (args: yargs.Argv) => {
            return args
                .command(new GenerateGqlSchemaCommand())
                .command(new CheckGqlSchemaCommand())
                .demandCommand();
        };
    }

    get handler(): (args: yargs.ArgumentsCamelCase) => void | Promise<void> {
        return async (_args: yargs.Arguments) => {
            // do nothing, all commands should be handled by subcommands
        };
    }
}
