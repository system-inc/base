// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as path from 'path';
import * as yargs from 'yargs';

import { CliArguments } from '../../common/CliHelpers';
import { BaseWorkerProject } from '../../project/BaseWorkerProject';
import {
    formatValidationResult,
    loadLatestSnapshot,
    validateSchemaCompatibility,
} from '../workspace/DurableSchemaCompatibilityValidator';
import { ormGetDatabaseName } from './OrmCommand';
import { getOrmAdapterType } from './OrmCommandHelper';

/**
 * Command for validating schema compatibility between Development and target environment.
 * Maps to: schema:compat
 *
 * Usage:
 *   node base orm schema:compat --worker connected-agent --target-environment Staging
 *   node base orm schema:compat --worker connected-agent --database @default --target-environment Production
 */
export class OrmSchemaValidateCompatibilityCommand
    implements yargs.CommandModule
{
    command = 'schema:compat [worker]';
    describe =
        'Check a target environment’s schema exactly matches Development (Durable DBs). Use -t <env>';

    get builder(): yargs.CommandBuilder | undefined {
        return (args: yargs.Argv) => {
            return args
                .positional('worker', {
                    describe:
                        'Worker to operate on. Inferred from CWD if omitted.',
                    type: 'string',
                })
                .option('target-environment', {
                    alias: 't',
                    type: 'string',
                    describe:
                        'Target environment to validate against (e.g., Staging, Production)',
                    demandOption: true,
                });
        };
    }

    get handler(): (args: yargs.ArgumentsCamelCase) => void | Promise<void> {
        return async (args: yargs.Arguments) => {
            const databaseName = ormGetDatabaseName(args);
            const targetEnvironment = args['target-environment'] as string;
            const [_platform, devEnvironment] =
                CliArguments.getPlatformAndEnvironment(args);
            const workerProject = BaseWorkerProject.create(args);

            // Ensure we're using Drizzle adapter
            const dbConfig = await getOrmAdapterType(
                workerProject,
                databaseName,
                devEnvironment,
            );

            if (dbConfig.adapterType !== 'drizzle') {
                throw new Error(
                    `Schema compatibility validation only supports Drizzle adapter, found: ${dbConfig.adapterType}`,
                );
            }

            // Only support Durable databases (SQLite)
            if (dbConfig.databaseType.driver !== 'durable') {
                throw new Error(
                    `Schema compatibility validation only supports Durable (SQLite) databases, found: ${dbConfig.databaseType.dialect}/${dbConfig.databaseType.driver}`,
                );
            }

            try {
                console.log('🔍 Validating schema compatibility...');
                console.log(`   Worker: ${workerProject.worker}`);
                console.log(`   Database: ${databaseName}`);
                console.log(`   Source: Development`);
                console.log(`   Target: ${targetEnvironment}`);
                console.log('');

                // Build paths to migration metadata directories
                const workerPath = workerProject.workerFolder;
                const databasePath = path.join(
                    workerPath,
                    'database',
                    databaseName,
                );

                const devMetaPath = path.join(
                    databasePath,
                    'Development',
                    'drizzle',
                    'migrations',
                    'meta',
                );
                const targetMetaPath = path.join(
                    databasePath,
                    targetEnvironment,
                    'drizzle',
                    'migrations',
                    'meta',
                );

                // Load snapshots
                const devSnapshot = await loadLatestSnapshot(devMetaPath);
                const targetSnapshot = await loadLatestSnapshot(targetMetaPath);

                // Validate compatibility
                const result = validateSchemaCompatibility(
                    devSnapshot.snapshot,
                    targetSnapshot.snapshot,
                    targetEnvironment,
                    devSnapshot.version,
                    targetSnapshot.version,
                );

                // Display results
                console.log(formatValidationResult(result));

                // Exit with appropriate code
                if (!result.compatible) {
                    process.exit(1);
                }
            } catch (error) {
                if (error instanceof Error) {
                    console.error(
                        '❌ Schema validation failed:',
                        error.message,
                    );
                } else {
                    console.error('❌ Schema validation failed:', error);
                }
                process.exit(1);
            }
        };
    }
}
