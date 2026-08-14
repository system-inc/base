// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Validator for Durable SQLite migrations to ensure they complete within
 * the 30-second timeout constraint and don't perform dangerous operations.
 *
 * Durable Objects have unique constraints:
 * - Each DO instance has its own SQLite database
 * - Migrations run in a 30-second blockConcurrencyWhile window
 * - All pending migrations must complete within that window
 * - Failed migrations retry on next access (infinite loop risk)
 * - Cannot query individual DOs to check data size
 */

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
    metadata: {
        totalMigrations: number;
        totalStatements: number;
        tablesCreated: string[];
    };
}

export interface ValidationError {
    migrationName: string;
    statement: string;
    rule: string;
    message: string;
    suggestion?: string;
}

export interface ValidationWarning {
    migrationName: string;
    statement?: string;
    rule: string;
    message: string;
}

interface MigrationFile {
    name: string;
    sql: string;
}

interface ParsedStatement {
    type: SQLStatementType;
    raw: string;
    tableName?: string;
    operation?: string;
}

type SQLStatementType =
    | 'CREATE_TABLE'
    | 'CREATE_INDEX'
    | 'CREATE_UNIQUE_INDEX'
    | 'DROP_TABLE'
    | 'DROP_INDEX'
    | 'ALTER_TABLE'
    | 'INSERT'
    | 'UPDATE'
    | 'DELETE'
    | 'VACUUM'
    | 'ANALYZE'
    | 'PRAGMA'
    | 'COMMENT'
    | 'UNKNOWN';

/**
 * Validates all durable SQLite migrations
 *
 * @param migrations - The migration files to validate
 * @param environment - The environment ('Development' for warnings, others for errors)
 */
export function validateMigrations(
    migrations: Record<string, string>,
    environment: string = 'Production',
): ValidationResult {
    const isDevelopment = environment === 'Development';
    const migrationFiles: MigrationFile[] = Object.entries(migrations).map(
        ([name, sql]) => ({
            name,
            sql,
        }),
    );

    const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
        metadata: {
            totalMigrations: migrationFiles.length,
            totalStatements: 0,
            tablesCreated: [],
        },
    };

    // Check total migration count
    // Note: These thresholds assume all migrations run in a single blockConcurrencyWhile window.
    // If using the one-at-a-time migration runner, these limits are less relevant since each
    // migration gets its own 30-second window.
    if (migrationFiles.length > 15) {
        result.warnings.push({
            migrationName: 'all',
            rule: 'MIGRATION_COUNT',
            message: `You have ${migrationFiles.length} migrations. If running all migrations in a single blockConcurrencyWhile window, this increases the risk of timeouts. Consider migration squashing or the one-at-a-time migration runner.`,
        });
    }

    if (migrationFiles.length > 25) {
        result.errors.push({
            migrationName: 'all',
            statement: '',
            rule: 'MIGRATION_COUNT_CRITICAL',
            message: `You have ${migrationFiles.length} migrations. If running all migrations in a single blockConcurrencyWhile window, this is too many to safely complete within the 30-second timeout. Use migration squashing or the one-at-a-time migration runner.`,
        });
        result.valid = false;
    }

    // Validate each migration
    for (const migration of migrationFiles) {
        validateSingleMigration(migration, result, isDevelopment);
    }

    return result;
}

/**
 * Validates a single migration file
 */
function validateSingleMigration(
    migration: MigrationFile,
    result: ValidationResult,
    isDevelopment: boolean,
): void {
    const statements = parseSQL(migration.sql);
    result.metadata.totalStatements += statements.length;

    // Track tables created in THIS migration (for index validation)
    const tablesCreatedInMigration = new Set<string>();

    // Detect Drizzle table-recreation pattern: CREATE __new_X, INSERT INTO __new_X, DROP X, RENAME __new_X TO X
    // PROHIBITED: These perform a full bulk copy of the table data which will hit CPU time
    // limits on large Durable Object SQLite databases (SQLITE_INTERRUPT).
    const drizzleRecreatedTables = detectDrizzleTableRecreation(statements);

    if (drizzleRecreatedTables.size > 0) {
        const tableList = [...drizzleRecreatedTables].join(', ');
        addError(
            result,
            migration.name,
            `INSERT INTO __new_X SELECT ... FROM X (tables: ${tableList})`,
            'TABLE_RECREATION_BULK_COPY',
            `Drizzle table-recreation pattern detected for: ${tableList}. ` +
                `This performs a full bulk copy of existing data (INSERT INTO __new_X SELECT * FROM X) ` +
                `which will exceed CPU time limits on large Durable Object SQLite databases, ` +
                `causing SQLITE_INTERRUPT errors.`,
            isDevelopment,
            'Only use additive operations in DO migrations (CREATE TABLE, ALTER TABLE ADD COLUMN, CREATE INDEX, DROP TABLE, DROP INDEX). ' +
                'If you need to change column types, nullability, or constraints, add a new column with the desired properties and backfill data using the task engine.',
        );
    }

    // Validate each statement
    for (const statement of statements) {
        // Track table creations (including __new_ tables for index validation)
        if (statement.type === 'CREATE_TABLE' && statement.tableName) {
            tablesCreatedInMigration.add(statement.tableName);
            result.metadata.tablesCreated.push(statement.tableName);
        }

        // Skip per-statement validation for recreation statements since we already
        // flagged the pattern above — no need to also flag individual INSERT/DROP/etc.
        if (isDrizzleRecreationStatement(statement, drizzleRecreatedTables)) {
            continue;
        }

        // Validate statement
        validateStatement(
            statement,
            migration.name,
            tablesCreatedInMigration,
            result,
            isDevelopment,
        );
    }
}

/**
 * Validates a single SQL statement against safety rules
 */
function validateStatement(
    statement: ParsedStatement,
    migrationName: string,
    tablesCreatedInMigration: Set<string>,
    result: ValidationResult,
    isDevelopment: boolean,
): void {
    // WARNING: DROP TABLE — fast metadata-only operation, but data is permanently lost.
    // Migrations are transactional so a failed migration will roll back the DROP.
    if (statement.type === 'DROP_TABLE') {
        result.warnings.push({
            migrationName,
            statement: statement.raw,
            rule: 'DROP_TABLE',
            message: `DROP TABLE '${statement.tableName ?? 'unknown'}' will permanently delete all data in this table. Ensure no code references this table.`,
        });
        return;
    }

    if (statement.type === 'INSERT') {
        addError(
            result,
            migrationName,
            statement.raw,
            'INSERT',
            'INSERT statements are prohibited in migrations. They can be slow on large tables and may timeout.',
            isDevelopment,
            'Use the task engine to safely insert or backfill data.',
        );
        return;
    }

    if (statement.type === 'DELETE') {
        addError(
            result,
            migrationName,
            statement.raw,
            'DELETE',
            'DELETE statements are prohibited in migrations. They can be slow and may timeout.',
            isDevelopment,
            'Use a data migration engine to safely delete data in chunks.',
        );
        return;
    }

    if (statement.type === 'UPDATE') {
        addError(
            result,
            migrationName,
            statement.raw,
            'UPDATE',
            'UPDATE statements are prohibited in migrations. Data backfills can be slow and may timeout.',
            isDevelopment,
            'Use a data migration engine to safely update data in chunks.',
        );
        return;
    }

    // PROHIBITED: Expensive operations
    if (statement.type === 'VACUUM') {
        addError(
            result,
            migrationName,
            statement.raw,
            'VACUUM',
            'VACUUM is prohibited. It reorganizes the entire database and is very slow.',
            isDevelopment,
        );
        return;
    }

    if (statement.type === 'ANALYZE') {
        addError(
            result,
            migrationName,
            statement.raw,
            'ANALYZE',
            'ANALYZE is prohibited. It performs table scans and can be slow on large tables.',
            isDevelopment,
        );
        return;
    }

    // PROHIBITED: ALTER TABLE operations
    if (statement.type === 'ALTER_TABLE') {
        validateAlterTable(
            statement,
            migrationName,
            tablesCreatedInMigration,
            result,
            isDevelopment,
        );
        return;
    }

    // PROHIBITED: CREATE UNIQUE INDEX on existing tables (requires full table scan + can fail)
    if (statement.type === 'CREATE_UNIQUE_INDEX' && statement.tableName) {
        const isNewTable = tablesCreatedInMigration.has(statement.tableName);

        // Allow unique indexes on tables created in the same migration
        if (!isNewTable) {
            addError(
                result,
                migrationName,
                statement.raw,
                'CREATE_UNIQUE_INDEX',
                'CREATE UNIQUE INDEX on existing tables is prohibited. It requires a full table scan and can fail if data has duplicates.',
                isDevelopment,
                `Create a new table with the unique index, then use a data migration to copy data.`,
            );
            return;
        }
    }

    // WARNING: CREATE INDEX on existing tables (not created in this migration)
    if (statement.type === 'CREATE_INDEX' && statement.tableName) {
        const isNewTable = tablesCreatedInMigration.has(statement.tableName);

        if (!isNewTable) {
            result.warnings.push({
                migrationName,
                statement: statement.raw,
                rule: 'CREATE_INDEX_EXISTING_TABLE',
                message: `CREATE INDEX on existing table '${statement.tableName}'. This is fine for typical DO tables but may be slow on tables with 100k+ rows.`,
            });
            return;
        }
    }

    // PROHIBITED: Dangerous PRAGMAs (journal mode changes, checkpoints, integrity checks)
    if (statement.type === 'PRAGMA') {
        if (isPragmaDangerous(statement.raw)) {
            addError(
                result,
                migrationName,
                statement.raw,
                'PRAGMA_DANGEROUS',
                'This PRAGMA is prohibited in migrations. It can cause slow operations or change database behavior in unexpected ways.',
                isDevelopment,
            );
            return;
        }
    }

    // WARNING: Unrecognized statement types — may be hand-written or exotic SQL
    if (statement.type === 'UNKNOWN') {
        result.warnings.push({
            migrationName,
            statement: statement.raw,
            rule: 'UNKNOWN_STATEMENT',
            message: `Unrecognized SQL statement detected. This may be a hand-written migration — review it manually to ensure it is safe for Durable Object SQLite.`,
        });
        return;
    }
}

/**
 * Validates ALTER TABLE statements
 */
function validateAlterTable(
    statement: ParsedStatement,
    migrationName: string,
    tablesCreatedInMigration: Set<string>,
    result: ValidationResult,
    isDevelopment: boolean,
): void {
    const sql = statement.raw.toUpperCase();
    const isNewTable =
        statement.tableName &&
        tablesCreatedInMigration.has(statement.tableName);

    // WARNING: DROP COLUMN — Drizzle handles this via table recreation, so a bare
    // ALTER TABLE DROP COLUMN would only come from a custom migration.
    if (sql.includes('DROP COLUMN')) {
        result.warnings.push({
            migrationName,
            statement: statement.raw,
            rule: 'ALTER_DROP_COLUMN',
            message: `ALTER TABLE DROP COLUMN on '${statement.tableName ?? 'unknown'}'. Drizzle normally handles column removal via table recreation. If this is a custom migration, ensure the column is not referenced by any indexes or triggers.`,
        });
        return;
    }

    // WARNING: RENAME COLUMN (fast metadata-only operation in SQLite, but verify code expects new name)
    if (sql.includes('RENAME COLUMN')) {
        result.warnings.push({
            migrationName,
            statement: statement.raw,
            rule: 'ALTER_RENAME_COLUMN',
            message:
                'ALTER TABLE RENAME COLUMN detected. This is a fast metadata-only operation in SQLite, but ensure all code references use the new column name.',
        });
        return;
    }

    // WARNING: RENAME TO (table) (fast metadata-only operation in SQLite, but verify code expects new name)
    if (sql.includes('RENAME TO')) {
        result.warnings.push({
            migrationName,
            statement: statement.raw,
            rule: 'ALTER_RENAME_TABLE',
            message:
                'ALTER TABLE RENAME TO detected. This is a fast metadata-only operation in SQLite, but ensure all code references use the new table name.',
        });
        return;
    }

    // Detect ADD COLUMN: Drizzle emits either "ADD COLUMN" or just "ADD `col`"
    const isAddColumn = sql.includes('ADD COLUMN') || /\bADD\s+`/.test(sql);

    if (isAddColumn) {
        if (sql.includes('NOT NULL') && !sql.includes('DEFAULT')) {
            // Allow on newly created tables (no data to violate constraint)
            if (!isNewTable) {
                addError(
                    result,
                    migrationName,
                    statement.raw,
                    'ALTER_ADD_COLUMN_NOT_NULL',
                    'ALTER TABLE ADD COLUMN with NOT NULL constraint (without DEFAULT) is prohibited on existing tables. It will fail on tables with existing data.',
                    isDevelopment,
                    'Either make the column nullable, or provide a DEFAULT value.',
                );
                return;
            }
        }

        // NOTE: ALTER TABLE ADD COLUMN with DEFAULT is safe in SQLite.
        // SQLite stores the default in the schema and applies it lazily on read — no table rewrite.

        // Check for constraint keywords after the column name/type definition
        // Use word-boundary matching to avoid false positives on column names
        if (/\bUNIQUE\b/.test(sql) || /\bFOREIGN\s+KEY\b/.test(sql)) {
            // Allow on newly created tables (no data to validate)
            if (!isNewTable) {
                addError(
                    result,
                    migrationName,
                    statement.raw,
                    'ALTER_ADD_CONSTRAINT',
                    'Adding UNIQUE or FOREIGN KEY constraints in ALTER TABLE is prohibited on existing tables. These require validation against existing data.',
                    isDevelopment,
                    'Create a new table with the constraints and migrate data instead.',
                );
                return;
            }
        }
    }
}

/**
 * Parses SQL into individual statements
 */
function parseSQL(sql: string): ParsedStatement[] {
    const statements: ParsedStatement[] = [];

    // Split by statement-breakpoint comments (Drizzle convention)
    const parts = sql.split('--> statement-breakpoint');

    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed || trimmed.startsWith('--')) {
            continue; // Skip empty or comment-only parts
        }

        // Remove comments
        const lines = trimmed.split('\n');
        const cleanLines = lines
            .filter((line) => !line.trim().startsWith('--'))
            .join('\n');
        const cleaned = cleanLines.trim();

        if (!cleaned) {
            continue;
        }

        // Split on semicolons to catch multiple statements within a single block
        // (Drizzle uses --> statement-breakpoint, but hand-written SQL may use semicolons)
        const subStatements = splitOnSemicolons(cleaned);

        for (const sub of subStatements) {
            statements.push(parseStatement(sub));
        }
    }

    return statements;
}

/**
 * Splits SQL on semicolons, respecting that CREATE TABLE statements
 * contain semicolons inside parenthesized column definitions.
 */
function splitOnSemicolons(sql: string): string[] {
    const results: string[] = [];
    let depth = 0;
    let current = '';

    for (const char of sql) {
        if (char === '(') {
            depth++;
            current += char;
        } else if (char === ')') {
            depth--;
            current += char;
        } else if (char === ';' && depth === 0) {
            const trimmed = current.trim();
            if (trimmed) {
                results.push(trimmed);
            }
            current = '';
        } else {
            current += char;
        }
    }

    const trimmed = current.trim();
    if (trimmed) {
        results.push(trimmed);
    }

    return results;
}

/**
 * Parses a single SQL statement
 */
function parseStatement(sql: string): ParsedStatement {
    const upperSQL = sql.toUpperCase();
    const trimmed = sql.trim();

    // Comments
    if (trimmed.startsWith('--') || trimmed.startsWith('/*')) {
        return { type: 'COMMENT', raw: sql };
    }

    // CREATE TABLE
    if (upperSQL.startsWith('CREATE TABLE')) {
        const tableName = extractTableName(sql, /CREATE\s+TABLE\s+`?(\w+)`?/i);
        return { type: 'CREATE_TABLE', raw: sql, tableName };
    }

    // CREATE UNIQUE INDEX
    if (upperSQL.startsWith('CREATE UNIQUE INDEX')) {
        const tableName = extractTableName(sql, /ON\s+`?(\w+)`?/i);
        return { type: 'CREATE_UNIQUE_INDEX', raw: sql, tableName };
    }

    // CREATE INDEX
    if (upperSQL.startsWith('CREATE INDEX')) {
        const tableName = extractTableName(sql, /ON\s+`?(\w+)`?/i);
        return { type: 'CREATE_INDEX', raw: sql, tableName };
    }

    // DROP TABLE
    if (upperSQL.startsWith('DROP TABLE')) {
        const tableName = extractTableName(sql, /DROP\s+TABLE\s+`?(\w+)`?/i);
        return { type: 'DROP_TABLE', raw: sql, tableName };
    }

    // DROP INDEX
    if (upperSQL.startsWith('DROP INDEX')) {
        return { type: 'DROP_INDEX', raw: sql };
    }

    // ALTER TABLE
    if (upperSQL.startsWith('ALTER TABLE')) {
        const tableName = extractTableName(sql, /ALTER\s+TABLE\s+`?(\w+)`?/i);
        return { type: 'ALTER_TABLE', raw: sql, tableName };
    }

    // INSERT
    if (upperSQL.startsWith('INSERT')) {
        const tableName = extractTableName(sql, /INSERT\s+INTO\s+`?(\w+)`?/i);
        return { type: 'INSERT', raw: sql, tableName };
    }

    // UPDATE
    if (upperSQL.startsWith('UPDATE')) {
        return { type: 'UPDATE', raw: sql };
    }

    // DELETE
    if (upperSQL.startsWith('DELETE')) {
        return { type: 'DELETE', raw: sql };
    }

    // VACUUM
    if (upperSQL.startsWith('VACUUM')) {
        return { type: 'VACUUM', raw: sql };
    }

    // ANALYZE
    if (upperSQL.startsWith('ANALYZE')) {
        return { type: 'ANALYZE', raw: sql };
    }

    // PRAGMA
    if (upperSQL.startsWith('PRAGMA')) {
        return { type: 'PRAGMA', raw: sql };
    }

    return { type: 'UNKNOWN', raw: sql };
}

/**
 * Extracts table name from SQL statement
 */
function extractTableName(sql: string, pattern: RegExp): string | undefined {
    const match = sql.match(pattern);
    return match?.[1];
}

/**
 * Checks if a PRAGMA statement is dangerous for migrations.
 * Uses a blocklist of known-dangerous PRAGMAs rather than an allowlist,
 * since most PRAGMAs are either read-only or safe session-level settings.
 */
function isPragmaDangerous(sql: string): boolean {
    const upperSQL = sql.toUpperCase();

    const dangerousPragmas = [
        'PRAGMA JOURNAL_MODE',
        'PRAGMA WAL_CHECKPOINT',
        'PRAGMA INCREMENTAL_VACUUM',
        'PRAGMA SHRINK_MEMORY',
        'PRAGMA OPTIMIZE',
        'PRAGMA INTEGRITY_CHECK',
        'PRAGMA QUICK_CHECK',
    ];

    for (const pragma of dangerousPragmas) {
        if (upperSQL.includes(pragma)) {
            return true;
        }
    }

    return false;
}

/**
 * Detects Drizzle's table-recreation pattern:
 *   CREATE TABLE `__new_X` (...)
 *   INSERT INTO `__new_X` ... SELECT ... FROM `X`
 *   DROP TABLE `X`
 *   ALTER TABLE `__new_X` RENAME TO `X`
 *
 * Returns a set of original table names (without __new_ prefix) that are being recreated.
 */
function detectDrizzleTableRecreation(
    statements: ParsedStatement[],
): Set<string> {
    const recreatedTables = new Set<string>();

    for (const statement of statements) {
        if (
            statement.type === 'CREATE_TABLE' &&
            statement.tableName?.startsWith('__new_')
        ) {
            recreatedTables.add(statement.tableName.slice(6)); // strip __new_
        }
    }

    return recreatedTables;
}

/**
 * Checks if a statement is part of Drizzle's table-recreation pattern.
 */
function isDrizzleRecreationStatement(
    statement: ParsedStatement,
    recreatedTables: Set<string>,
): boolean {
    if (recreatedTables.size === 0) return false;

    const tableName = statement.tableName;
    if (!tableName) return false;

    // CREATE TABLE `__new_X` — part of recreation
    if (
        statement.type === 'CREATE_TABLE' &&
        tableName.startsWith('__new_') &&
        recreatedTables.has(tableName.slice(6))
    ) {
        return true;
    }

    // INSERT INTO `__new_X` SELECT FROM `X` — data copy
    if (
        statement.type === 'INSERT' &&
        tableName.startsWith('__new_') &&
        recreatedTables.has(tableName.slice(6))
    ) {
        return true;
    }

    // DROP TABLE `X` — dropping the original to replace with __new_X
    if (statement.type === 'DROP_TABLE' && recreatedTables.has(tableName)) {
        return true;
    }

    // ALTER TABLE `__new_X` RENAME TO `X`
    if (
        statement.type === 'ALTER_TABLE' &&
        tableName.startsWith('__new_') &&
        recreatedTables.has(tableName.slice(6)) &&
        statement.raw.toUpperCase().includes('RENAME TO')
    ) {
        return true;
    }

    return false;
}

/**
 * Adds an error or warning to the validation result based on environment
 *
 * In development: Adds as warning (allows operation but educates)
 * In production: Adds as error (blocks operation)
 */
function addError(
    result: ValidationResult,
    migrationName: string,
    statement: string,
    rule: string,
    message: string,
    isDevelopment: boolean,
    suggestion?: string,
): void {
    if (isDevelopment) {
        // In development: Add as warning with production blocking notice
        result.warnings.push({
            migrationName,
            statement,
            rule,
            message: `⚠️  ${message}\n\n   🚫 This will BLOCK deployment to production!\n\n   ${suggestion ? `SAFER ALTERNATIVE: ${suggestion}` : ''}`,
        });
    } else {
        // In production: Add as error (blocking)
        result.errors.push({
            migrationName,
            statement,
            rule,
            message,
            suggestion,
        });
        result.valid = false;
    }
}
