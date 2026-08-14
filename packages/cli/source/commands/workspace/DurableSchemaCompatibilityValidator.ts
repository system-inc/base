// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Schema compatibility validator for Durable Object SQLite databases.
 *
 * This validator ensures that the target environment's database schema
 * is compatible with the code being deployed by comparing Drizzle snapshots.
 *
 * Philosophy: STRICT EXACT MATCH
 * - Development snapshot represents the schema the current code expects
 * - Target environment must have EXACTLY the same schema
 * - Any divergence indicates either missing migrations or schema drift
 * - Prevents deployment of code that will fail due to schema mismatches
 */

export interface DrizzleSnapshot {
    version: string;
    dialect: 'sqlite' | 'mysql';
    id: string;
    prevId: string;
    tables: Record<string, DrizzleTable>;
    views: Record<string, unknown>;
    enums: Record<string, unknown>;
    _meta: {
        schemas: Record<string, unknown>;
        tables: Record<string, unknown>;
        columns: Record<string, unknown>;
    };
    internal: {
        indexes: Record<string, unknown>;
    };
}

export interface DrizzleTable {
    name: string;
    columns: Record<string, DrizzleColumn>;
    indexes: Record<string, DrizzleIndex>;
    foreignKeys: Record<string, unknown>;
    compositePrimaryKeys: Record<string, unknown>;
    uniqueConstraints: Record<string, unknown>;
    checkConstraints: Record<string, unknown>;
}

export interface DrizzleColumn {
    name: string;
    type: 'text' | 'integer' | 'blob' | 'real';
    primaryKey: boolean;
    notNull: boolean;
    autoincrement: boolean;
}

export interface DrizzleIndex {
    name: string;
    columns: string[];
    isUnique: boolean;
}

export interface SchemaCompatibilityResult {
    compatible: boolean;
    targetEnvironment: string;
    devSnapshotVersion: string;
    targetSnapshotVersion: string;
    errors: SchemaCompatibilityIssue[];
    warnings: SchemaCompatibilityIssue[];
}

export interface SchemaCompatibilityIssue {
    rule: string;
    severity: 'ERROR' | 'WARNING';
    table?: string;
    column?: string;
    index?: string;
    message: string;
    devValue?: unknown;
    targetValue?: unknown;
    suggestion?: string;
}

/**
 * Validates schema compatibility between Development and target environment.
 *
 * @param devSnapshot - The Development environment snapshot (source of truth)
 * @param targetSnapshot - The target environment snapshot to validate
 * @param targetEnvironment - Name of target environment (e.g., "Staging", "Production")
 * @param devVersion - Development snapshot version identifier (e.g., "0005")
 * @param targetVersion - Target snapshot version identifier (e.g., "0002")
 * @returns Validation result with errors and warnings
 */
export function validateSchemaCompatibility(
    devSnapshot: DrizzleSnapshot,
    targetSnapshot: DrizzleSnapshot,
    targetEnvironment: string,
    devVersion: string,
    targetVersion: string,
): SchemaCompatibilityResult {
    const result: SchemaCompatibilityResult = {
        compatible: true,
        targetEnvironment,
        devSnapshotVersion: devVersion,
        targetSnapshotVersion: targetVersion,
        errors: [],
        warnings: [],
    };

    // Validate table-level compatibility
    validateTables(devSnapshot, targetSnapshot, result);

    // For each matching table, validate column-level compatibility
    const devTableNames = Object.keys(devSnapshot.tables);
    const targetTableNames = Object.keys(targetSnapshot.tables);
    const commonTables = devTableNames.filter((name) =>
        targetTableNames.includes(name),
    );

    for (const tableName of commonTables) {
        validateTableColumns(
            devSnapshot.tables[tableName],
            targetSnapshot.tables[tableName],
            tableName,
            result,
        );
        validateTableIndexes(
            devSnapshot.tables[tableName],
            targetSnapshot.tables[tableName],
            tableName,
            result,
        );
    }

    // Set overall compatibility status
    result.compatible = result.errors.length === 0;

    return result;
}

/**
 * Validates that tables match exactly between Development and target.
 */
function validateTables(
    devSnapshot: DrizzleSnapshot,
    targetSnapshot: DrizzleSnapshot,
    result: SchemaCompatibilityResult,
): void {
    const devTables = Object.keys(devSnapshot.tables).sort();
    const targetTables = Object.keys(targetSnapshot.tables).sort();

    // Check for tables in Dev but not in Target (missing migrations)
    const missingInTarget = devTables.filter((t) => !targetTables.includes(t));
    for (const tableName of missingInTarget) {
        result.errors.push({
            rule: 'MISSING_TABLE_IN_TARGET',
            severity: 'ERROR',
            table: tableName,
            message: `Table '${tableName}' exists in Development but not in ${result.targetEnvironment}`,
            devValue: 'exists',
            targetValue: 'missing',
            suggestion: `Run migrations in ${result.targetEnvironment} before deploying`,
        });
    }

    // Check for tables in Target but not in Dev (schema divergence!)
    const extraInTarget = targetTables.filter((t) => !devTables.includes(t));
    for (const tableName of extraInTarget) {
        result.errors.push({
            rule: 'EXTRA_TABLE_IN_TARGET',
            severity: 'ERROR',
            table: tableName,
            message: `Table '${tableName}' exists in ${result.targetEnvironment} but not in Development`,
            devValue: 'missing',
            targetValue: 'exists',
            suggestion:
                'Schema divergence detected! This table may have been added directly to ' +
                `${result.targetEnvironment} or removed from Development. Manual intervention required.`,
        });
    }
}

/**
 * Validates that columns match exactly for a given table.
 */
function validateTableColumns(
    devTable: DrizzleTable,
    targetTable: DrizzleTable,
    tableName: string,
    result: SchemaCompatibilityResult,
): void {
    const devColumns = Object.keys(devTable.columns).sort();
    const targetColumns = Object.keys(targetTable.columns).sort();

    // Check for columns in Dev but not in Target
    const missingInTarget = devColumns.filter(
        (c) => !targetColumns.includes(c),
    );
    for (const columnName of missingInTarget) {
        result.errors.push({
            rule: 'MISSING_COLUMN_IN_TARGET',
            severity: 'ERROR',
            table: tableName,
            column: columnName,
            message: `Column '${tableName}.${columnName}' exists in Development but not in ${result.targetEnvironment}`,
            devValue: devTable.columns[columnName],
            targetValue: 'missing',
            suggestion: `Run migrations in ${result.targetEnvironment} before deploying`,
        });
    }

    // Check for columns in Target but not in Dev
    const extraInTarget = targetColumns.filter((c) => !devColumns.includes(c));
    for (const columnName of extraInTarget) {
        result.errors.push({
            rule: 'EXTRA_COLUMN_IN_TARGET',
            severity: 'ERROR',
            table: tableName,
            column: columnName,
            message: `Column '${tableName}.${columnName}' exists in ${result.targetEnvironment} but not in Development`,
            devValue: 'missing',
            targetValue: targetTable.columns[columnName],
            suggestion:
                'Schema divergence detected! This column may have been added directly to ' +
                `${result.targetEnvironment} or removed from Development. Manual intervention required.`,
        });
    }

    // For matching columns, validate properties
    const commonColumns = devColumns.filter((c) => targetColumns.includes(c));
    for (const columnName of commonColumns) {
        validateColumnProperties(
            devTable.columns[columnName],
            targetTable.columns[columnName],
            tableName,
            columnName,
            result,
        );
    }
}

/**
 * Validates that column properties match exactly.
 */
function validateColumnProperties(
    devColumn: DrizzleColumn,
    targetColumn: DrizzleColumn,
    tableName: string,
    columnName: string,
    result: SchemaCompatibilityResult,
): void {
    // Check type mismatch
    if (devColumn.type !== targetColumn.type) {
        result.errors.push({
            rule: 'COLUMN_TYPE_MISMATCH',
            severity: 'ERROR',
            table: tableName,
            column: columnName,
            message: `Column '${tableName}.${columnName}' has mismatched types`,
            devValue: devColumn.type,
            targetValue: targetColumn.type,
            suggestion:
                'Schema divergence detected! Column types must match exactly. Manual intervention required.',
        });
    }

    // Check nullability mismatch
    if (devColumn.notNull !== targetColumn.notNull) {
        result.errors.push({
            rule: 'COLUMN_NULLABILITY_MISMATCH',
            severity: 'ERROR',
            table: tableName,
            column: columnName,
            message: `Column '${tableName}.${columnName}' has mismatched nullability`,
            devValue: devColumn.notNull ? 'NOT NULL' : 'NULLABLE',
            targetValue: targetColumn.notNull ? 'NOT NULL' : 'NULLABLE',
            suggestion:
                'Schema divergence detected! Nullability must match exactly. Manual intervention required.',
        });
    }

    // Check primary key mismatch
    if (devColumn.primaryKey !== targetColumn.primaryKey) {
        result.errors.push({
            rule: 'COLUMN_PRIMARY_KEY_MISMATCH',
            severity: 'ERROR',
            table: tableName,
            column: columnName,
            message: `Column '${tableName}.${columnName}' has mismatched primary key constraint`,
            devValue: devColumn.primaryKey ? 'PRIMARY KEY' : 'NOT PRIMARY KEY',
            targetValue: targetColumn.primaryKey
                ? 'PRIMARY KEY'
                : 'NOT PRIMARY KEY',
            suggestion:
                'Schema divergence detected! Primary key constraints must match exactly. Manual intervention required.',
        });
    }

    // Check autoincrement mismatch
    if (devColumn.autoincrement !== targetColumn.autoincrement) {
        result.errors.push({
            rule: 'COLUMN_AUTOINCREMENT_MISMATCH',
            severity: 'ERROR',
            table: tableName,
            column: columnName,
            message: `Column '${tableName}.${columnName}' has mismatched autoincrement setting`,
            devValue: devColumn.autoincrement
                ? 'AUTOINCREMENT'
                : 'NOT AUTOINCREMENT',
            targetValue: targetColumn.autoincrement
                ? 'AUTOINCREMENT'
                : 'NOT AUTOINCREMENT',
            suggestion:
                'Schema divergence detected! Autoincrement settings must match exactly. Manual intervention required.',
        });
    }
}

/**
 * Validates that indexes match between Development and target.
 * Index mismatches are warnings (performance impact only, not breaking).
 */
function validateTableIndexes(
    devTable: DrizzleTable,
    targetTable: DrizzleTable,
    tableName: string,
    result: SchemaCompatibilityResult,
): void {
    const devIndexes = Object.keys(devTable.indexes).sort();
    const targetIndexes = Object.keys(targetTable.indexes).sort();

    // Check for indexes in Dev but not in Target
    const missingInTarget = devIndexes.filter(
        (i) => !targetIndexes.includes(i),
    );
    for (const indexName of missingInTarget) {
        result.warnings.push({
            rule: 'MISSING_INDEX_IN_TARGET',
            severity: 'WARNING',
            table: tableName,
            index: indexName,
            message: `Index '${indexName}' on table '${tableName}' exists in Development but not in ${result.targetEnvironment}`,
            devValue: devTable.indexes[indexName],
            targetValue: 'missing',
            suggestion:
                'Performance may be degraded until migrations run. This does not block deployment.',
        });
    }

    // Check for indexes in Target but not in Dev
    const extraInTarget = targetIndexes.filter((i) => !devIndexes.includes(i));
    for (const indexName of extraInTarget) {
        result.warnings.push({
            rule: 'EXTRA_INDEX_IN_TARGET',
            severity: 'WARNING',
            table: tableName,
            index: indexName,
            message: `Index '${indexName}' on table '${tableName}' exists in ${result.targetEnvironment} but not in Development`,
            devValue: 'missing',
            targetValue: targetTable.indexes[indexName],
            suggestion:
                'Schema divergence detected in indexes. This does not block deployment but should be investigated.',
        });
    }

    // For matching indexes, validate properties
    const commonIndexes = devIndexes.filter((i) => targetIndexes.includes(i));
    for (const indexName of commonIndexes) {
        const devIndex = devTable.indexes[indexName];
        const targetIndex = targetTable.indexes[indexName];

        // Check if column lists match
        const devCols = [...devIndex.columns].sort().join(',');
        const targetCols = [...targetIndex.columns].sort().join(',');

        if (devCols !== targetCols) {
            result.warnings.push({
                rule: 'INDEX_COLUMNS_MISMATCH',
                severity: 'WARNING',
                table: tableName,
                index: indexName,
                message: `Index '${indexName}' on table '${tableName}' has mismatched column definitions`,
                devValue: devIndex.columns,
                targetValue: targetIndex.columns,
                suggestion:
                    'Index column mismatch detected. This does not block deployment but may affect query performance.',
            });
        }

        // Check if uniqueness matches
        if (devIndex.isUnique !== targetIndex.isUnique) {
            result.warnings.push({
                rule: 'INDEX_UNIQUENESS_MISMATCH',
                severity: 'WARNING',
                table: tableName,
                index: indexName,
                message: `Index '${indexName}' on table '${tableName}' has mismatched uniqueness constraint`,
                devValue: devIndex.isUnique ? 'UNIQUE' : 'NON-UNIQUE',
                targetValue: targetIndex.isUnique ? 'UNIQUE' : 'NON-UNIQUE',
                suggestion:
                    'Index uniqueness mismatch detected. This does not block deployment but indicates schema divergence.',
            });
        }
    }
}

/**
 * Loads the latest snapshot from a migrations meta directory.
 *
 * @param metaPath - Path to the migrations meta directory
 * @returns The latest snapshot and its version identifier
 * @throws Error if journal or snapshot files cannot be read
 */
export async function loadLatestSnapshot(metaPath: string): Promise<{
    snapshot: DrizzleSnapshot;
    version: string;
}> {
    const fs = await import('fs/promises');
    const path = await import('path');

    // Read the journal to find the latest migration
    const journalPath = path.join(metaPath, '_journal.json');

    let journalContent: string;
    try {
        journalContent = await fs.readFile(journalPath, 'utf-8');
    } catch (error) {
        throw new Error(
            `Failed to read migration journal at ${journalPath}. ` +
                `Ensure migrations have been generated for this environment. ` +
                `Original error: ${error instanceof Error ? error.message : String(error)}`,
        );
    }

    const journal = JSON.parse(journalContent) as {
        entries: Array<{ idx: number; tag: string }>;
    };

    if (!journal.entries || journal.entries.length === 0) {
        throw new Error(
            `No migrations found in journal at ${journalPath}. ` +
                `Generate migrations first using 'orm schema:generate'.`,
        );
    }

    // Find the highest idx (latest migration)
    const latestEntry = journal.entries.reduce((latest, current) =>
        current.idx > latest.idx ? current : latest,
    );

    // Load the corresponding snapshot
    const snapshotFileName = `${String(latestEntry.idx).padStart(4, '0')}_snapshot.json`;
    const snapshotPath = path.join(metaPath, snapshotFileName);

    let snapshotContent: string;
    try {
        snapshotContent = await fs.readFile(snapshotPath, 'utf-8');
    } catch (error) {
        throw new Error(
            `Failed to read snapshot at ${snapshotPath}. ` +
                `The snapshot file may be missing or corrupted. ` +
                `Original error: ${error instanceof Error ? error.message : String(error)}`,
        );
    }

    const snapshot = JSON.parse(snapshotContent) as DrizzleSnapshot;

    return {
        snapshot,
        version: String(latestEntry.idx).padStart(4, '0'),
    };
}

/**
 * Formats a validation result for console output.
 */
export function formatValidationResult(
    result: SchemaCompatibilityResult,
): string {
    const lines: string[] = [];

    // Header
    lines.push('');
    if (result.compatible) {
        lines.push('✅ Schema Compatibility Check PASSED');
    } else {
        lines.push('❌ Schema Compatibility Check FAILED');
    }
    lines.push('');
    lines.push(
        `Comparing Development (${result.devSnapshotVersion}) → ${result.targetEnvironment} (${result.targetSnapshotVersion})`,
    );
    lines.push('');

    // Errors
    if (result.errors.length > 0) {
        lines.push(`ERRORS (${result.errors.length}):`);
        for (const error of result.errors) {
            lines.push(`  ❌ ${error.rule}`);
            if (error.table && error.column) {
                lines.push(`     [${error.table}.${error.column}]`);
            } else if (error.table) {
                lines.push(`     [${error.table}]`);
            }
            lines.push(`     ${error.message}`);
            if (
                error.devValue !== undefined &&
                error.targetValue !== undefined
            ) {
                lines.push(
                    `     Dev: ${JSON.stringify(error.devValue)} | Target: ${JSON.stringify(error.targetValue)}`,
                );
            }
            if (error.suggestion) {
                lines.push(`     → ${error.suggestion}`);
            }
            lines.push('');
        }
    }

    // Warnings
    if (result.warnings.length > 0) {
        lines.push(`WARNINGS (${result.warnings.length}):`);
        for (const warning of result.warnings) {
            lines.push(`  ⚠️  ${warning.rule}`);
            if (warning.table && warning.index) {
                lines.push(`     [${warning.table}.${warning.index}]`);
            } else if (warning.table && warning.column) {
                lines.push(`     [${warning.table}.${warning.column}]`);
            } else if (warning.table) {
                lines.push(`     [${warning.table}]`);
            }
            lines.push(`     ${warning.message}`);
            if (
                warning.devValue !== undefined &&
                warning.targetValue !== undefined
            ) {
                lines.push(
                    `     Dev: ${JSON.stringify(warning.devValue)} | Target: ${JSON.stringify(warning.targetValue)}`,
                );
            }
            if (warning.suggestion) {
                lines.push(`     → ${warning.suggestion}`);
            }
            lines.push('');
        }
    }

    // Footer
    if (!result.compatible) {
        lines.push(
            `🚫 BLOCKED: Cannot deploy to ${result.targetEnvironment} until schemas match`,
        );
    } else if (result.warnings.length > 0) {
        lines.push(
            `✅ Deployment allowed, but ${result.warnings.length} warning(s) should be addressed`,
        );
    } else {
        lines.push(
            `✅ Schemas match exactly. Safe to deploy to ${result.targetEnvironment}`,
        );
    }
    lines.push('');

    return lines.join('\n');
}
