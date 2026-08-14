// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { ValidationResult } from './DurableSqliteMigrationValidator';

/**
 * Displays validation results (errors and warnings) for durable SQLite migrations
 * in a consistent format across CLI commands.
 */
export function displayValidationResults(
    validationResult: ValidationResult,
    environment: string,
    databaseName: string,
): void {
    // Print errors
    if (validationResult.errors.length > 0) {
        console.error(
            '\n❌ VALIDATION FAILED: Durable SQLite migrations contain prohibited operations\n',
        );
        console.error(
            '⚠️  These operations may cause timeouts or infinite retry loops in Durable Objects.\n',
        );

        for (const error of validationResult.errors) {
            console.error(
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            );
            console.error(`Migration: ${error.migrationName.toUpperCase()}`);
            console.error(`Rule:      ${error.rule}`);
            console.error(`Error:     ${error.message}`);
            if (error.statement) {
                console.error(`\nStatement:\n${error.statement}\n`);
            }
            if (error.suggestion) {
                console.error(`💡 Suggestion:\n${error.suggestion}\n`);
            }
        }
        console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    }

    // Print warnings
    if (validationResult.warnings.length > 0) {
        const warningHeader =
            environment === 'Development'
                ? '\n⚠️  DEVELOPMENT WARNINGS: These operations are prohibited in production\n'
                : '\n⚠️  WARNINGS: Potential issues detected in durable SQLite migrations\n';

        console.warn(warningHeader);

        for (const warning of validationResult.warnings) {
            console.warn(
                `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            );
            console.warn(`Migration: ${warning.migrationName.toUpperCase()}`);
            console.warn(`Rule:      ${warning.rule}`);
            console.warn(`Warning:   ${warning.message}`);
            if (warning.statement) {
                console.warn(`\nStatement:\n${warning.statement}\n`);
            }
        }
        console.warn(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    }

    // Print summary
    if (validationResult.valid) {
        console.log(
            `✅ Durable SQLite migration validation passed for database '${databaseName}'`,
        );
        console.log(
            `   - ${validationResult.metadata.totalMigrations} migrations validated`,
        );
        console.log(
            `   - ${validationResult.metadata.totalStatements} SQL statements analyzed`,
        );
        console.log(
            `   - ${validationResult.metadata.tablesCreated.length} tables created`,
        );
    } else {
        console.error(
            `\n❌ Durable SQLite migration validation FAILED for database '${databaseName}'`,
        );
        console.error(
            `   Found ${validationResult.errors.length} error(s) that must be fixed.\n`,
        );
    }
}
