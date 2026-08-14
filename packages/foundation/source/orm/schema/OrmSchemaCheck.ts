// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ormIndexColumnName } from '../interfaces/OrmIndexColumn';
import { getPrimaryKeyColumns } from '../metadata/OrmPrimaryKeyInfo';
import { ormGetTable } from '../metadata/OrmSchemaRegistry';
import { OrmTableMetadata } from '../metadata/OrmTableMetadata';

export function checkTableSchema(
    tableMeta: OrmTableMetadata,
    _dialect: 'mysql' | 'sqlite',
): void {
    checkTableMetaPrimaryKeys(tableMeta);
    checkColumnReferences(tableMeta);
    checkIndexReferences(tableMeta);
    checkUniqueConstraintReferences(tableMeta);
    checkRelationReferences(tableMeta);
    checkJoinColumnReferences(tableMeta);
    checkDuplicateConstraintNames(tableMeta);
    checkColumnNameConflicts(tableMeta);
    checkIncompatibleColumnOptions(tableMeta);
}

export function checkSchemaSet(
    tables: OrmTableMetadata[],
    dialect: 'mysql' | 'sqlite',
): void {
    // First check each table individually
    for (const table of tables) {
        checkTableSchema(table, dialect);
    }

    // Then check cross-table concerns
    checkCrossTableRelations(tables);
    checkCircularDependencies(tables);
}

function checkTableMetaPrimaryKeys(tableMeta: OrmTableMetadata): void {
    // Check if we have a primary key defined
    if (!tableMeta.primaryKey) {
        throw new Error(`Table ${tableMeta.name} must have a primary key`);
    }

    // Get the primary key columns
    const pkColumns = getPrimaryKeyColumns(tableMeta.primaryKey);
    if (pkColumns.length === 0) {
        throw new Error(
            `Table ${tableMeta.name} has a primary key defined but no columns specified`,
        );
    }

    // Check that all primary key columns exist
    const columnNames = new Set(tableMeta.columns.map((c) => c.propertyKey));
    for (const pkCol of pkColumns) {
        if (!columnNames.has(pkCol)) {
            throw new Error(
                `Table ${tableMeta.name}: Primary key references non-existent column '${pkCol}'`,
            );
        }
    }

    // Every column flagged primaryKey must be part of the table's primary
    // key — a flagged column outside it means a second, competing primary
    // key declaration survived registration (e.g. hand-built metadata).
    for (const col of tableMeta.columns) {
        if (
            col.options?.primaryKey === true &&
            !pkColumns.includes(col.propertyKey)
        ) {
            throw new Error(
                `Table ${tableMeta.name}: Column '${col.propertyKey}' is marked primaryKey but the table's primary key is (${pkColumns.join(', ')}). A table has exactly one primary key — declare compound keys with @OrmPrimaryKey([...]).`,
            );
        }
    }
}

function checkColumnReferences(tableMeta: OrmTableMetadata): void {
    // Check for duplicate column names
    const seenColumns = new Set<string>();
    for (const col of tableMeta.columns) {
        if (seenColumns.has(col.propertyKey)) {
            throw new Error(
                `Table ${tableMeta.name}: Duplicate column name '${col.propertyKey}'`,
            );
        }
        seenColumns.add(col.propertyKey);
    }
}

function checkIndexReferences(tableMeta: OrmTableMetadata): void {
    const columnNames = new Set(tableMeta.columns.map((c) => c.propertyKey));

    for (const index of tableMeta.indexes) {
        // Check that all indexed columns exist
        for (const indexCol of index.columns) {
            const indexColName = ormIndexColumnName(indexCol);
            if (!columnNames.has(indexColName)) {
                throw new Error(
                    `Table ${tableMeta.name}: Index '${index.name}' references non-existent column '${indexColName}'`,
                );
            }
        }

        // Check that index has at least one column
        if (index.columns.length === 0) {
            throw new Error(
                `Table ${tableMeta.name}: Index '${index.name}' has no columns`,
            );
        }
    }
}

function checkUniqueConstraintReferences(tableMeta: OrmTableMetadata): void {
    const columnNames = new Set(tableMeta.columns.map((c) => c.propertyKey));

    for (const unique of tableMeta.uniqueConstraints) {
        // Check that all unique constraint columns exist
        for (const uniqueCol of unique.columns) {
            if (!columnNames.has(uniqueCol)) {
                throw new Error(
                    `Table ${tableMeta.name}: Unique constraint '${unique.name || 'unnamed'}' references non-existent column '${uniqueCol}'`,
                );
            }
        }

        // Check that unique constraint has at least one column
        if (unique.columns.length === 0) {
            throw new Error(
                `Table ${tableMeta.name}: Unique constraint '${unique.name || 'unnamed'}' has no columns`,
            );
        }
    }
}

function checkRelationReferences(tableMeta: OrmTableMetadata): void {
    // Build a map of both property names and database column names
    const columnPropertyNames = new Set(
        tableMeta.columns.map((c) => c.propertyKey),
    );
    const columnDatabaseNames = new Set(
        tableMeta.columns.map((c) => c.options?.name || c.propertyKey),
    );

    for (const relation of tableMeta.relations) {
        // Check many-to-one and one-to-one join columns exist
        if (relation.type === 'many-to-one') {
            // Many-to-one always has the join column on this side
            // Check if the join column exists in the table
            const customJoinCol = tableMeta.joinColumns?.[relation.propertyKey];
            const joinColName = customJoinCol?.name || relation.joinColumn;

            // Check if the column exists either as a property name or database column name
            if (
                !columnPropertyNames.has(joinColName) &&
                !columnDatabaseNames.has(joinColName)
            ) {
                throw new Error(
                    `Table ${tableMeta.name}: Relation '${relation.propertyKey}' references non-existent join column '${joinColName}'`,
                );
            }
        } else if (relation.type === 'one-to-one') {
            // One-to-one may have the join column on either side
            // Only check if this side is the owning side (has the join column)
            const customJoinCol = tableMeta.joinColumns?.[relation.propertyKey];

            // If there's a custom join column defined, this is the owning side
            if (customJoinCol?.name) {
                const joinColName = customJoinCol.name;
                if (
                    !columnPropertyNames.has(joinColName) &&
                    !columnDatabaseNames.has(joinColName)
                ) {
                    throw new Error(
                        `Table ${tableMeta.name}: Relation '${relation.propertyKey}' references non-existent join column '${joinColName}'`,
                    );
                }
            } else if (
                columnPropertyNames.has(relation.joinColumn) ||
                columnDatabaseNames.has(relation.joinColumn)
            ) {
                // If the default join column exists, validate it
                // Otherwise, assume the other side owns the relation
            }
        }
    }
}

function checkJoinColumnReferences(tableMeta: OrmTableMetadata): void {
    // Check that join column configurations reference existing relations
    if (tableMeta.joinColumns) {
        const relationNames = new Set(
            tableMeta.relations.map((r) => r.propertyKey),
        );

        for (const [propertyKey, _joinColConfig] of Object.entries(
            tableMeta.joinColumns,
        )) {
            if (!relationNames.has(propertyKey)) {
                throw new Error(
                    `Table ${tableMeta.name}: @OrmJoinColumn on '${propertyKey}' does not have a corresponding relation decorator`,
                );
            }

            // Check that the custom column name exists if specified
            // Note: The column name might be a database column name (via options.name)
            // or might not exist if it's pointing to a column that should exist
            // We'll skip this check since the relation check already validates it
        }
    }
}

function checkDuplicateConstraintNames(tableMeta: OrmTableMetadata): void {
    const constraintNames = new Set<string>();

    // Check index names (skip those without names as they'll be generated)
    for (const index of tableMeta.indexes) {
        if (index.name === undefined) {
            throw new Error(
                `Table ${tableMeta.name}: Index '${index.columns.join(', ')}' must have a name`,
            );
        }
        if (constraintNames.has(index.name)) {
            throw new Error(
                `Table ${tableMeta.name}: Duplicate constraint name '${index.name}'`,
            );
        }
        constraintNames.add(index.name);
    }

    // Check unique constraint names
    for (const unique of tableMeta.uniqueConstraints) {
        if (unique.name) {
            if (constraintNames.has(unique.name)) {
                throw new Error(
                    `Table ${tableMeta.name}: Duplicate constraint name '${unique.name}'`,
                );
            }
            constraintNames.add(unique.name);
        }
    }

    // Check primary key name if custom
    if (
        tableMeta.primaryKey?.type === 'composite' &&
        tableMeta.primaryKey.name
    ) {
        if (constraintNames.has(tableMeta.primaryKey.name)) {
            throw new Error(
                `Table ${tableMeta.name}: Duplicate constraint name '${tableMeta.primaryKey.name}'`,
            );
        }
    }
}

function checkColumnNameConflicts(tableMeta: OrmTableMetadata): void {
    // Check for conflicts between property names and custom column names
    const allColumnNames = new Set<string>();

    for (const col of tableMeta.columns) {
        const actualName = col.options?.name || col.propertyKey;

        if (allColumnNames.has(actualName)) {
            throw new Error(
                `Table ${tableMeta.name}: Multiple columns map to database column name '${actualName}'`,
            );
        }
        allColumnNames.add(actualName);
    }
}

function checkIncompatibleColumnOptions(tableMeta: OrmTableMetadata): void {
    for (const col of tableMeta.columns) {
        // Check nullable primary keys
        if (col.options?.primaryKey && col.options?.nullable) {
            throw new Error(
                `Table ${tableMeta.name}: Column '${col.propertyKey}' cannot be both primary key and nullable`,
            );
        }

        // Check auto-increment on non-numeric types
        if (col.type.kind === 'integer' || col.type.kind === 'bigint') {
            // These can have increment
        } else if ('increment' in col.type && col.type.increment) {
            throw new Error(
                `Table ${tableMeta.name}: Column '${col.propertyKey}' with type '${col.type.kind}' cannot have auto-increment`,
            );
        }

        // Check UUID generation on non-UUID columns
        if (col.type.kind === 'uuid' && col.type.generate) {
            // This is fine
        } else if (col.type.kind !== 'uuid' && 'generate' in col.type) {
            throw new Error(
                `Table ${tableMeta.name}: Column '${col.propertyKey}' with type '${col.type.kind}' cannot have generate flag`,
            );
        }
    }
}

function checkCrossTableRelations(tables: OrmTableMetadata[]): void {
    for (const table of tables) {
        for (const relation of table.relations) {
            // Get the target entity metadata
            const targetCtor = relation.target();
            const targetMeta = ormGetTable(targetCtor);

            if (!targetMeta) {
                throw new Error(
                    `Table ${table.name}: Relation '${relation.propertyKey}' references unknown target entity`,
                );
            }

            // Check that target table is in the schema set (if we're validating a subset)
            // This is optional - you might want to allow references to tables not in the current set

            // Check bidirectional relations are consistent
            if (relation.inverseSide) {
                const inverseRelation = targetMeta.relations.find(
                    (r) => r.propertyKey === relation.inverseSide,
                );

                if (!inverseRelation) {
                    throw new Error(
                        `Table ${table.name}: Relation '${relation.propertyKey}' specifies inverseSide '${relation.inverseSide}' which doesn't exist on target entity ${targetMeta.name}`,
                    );
                }

                // Check that the inverse relation points back correctly
                if (
                    relation.type === 'one-to-many' &&
                    inverseRelation.type !== 'many-to-one'
                ) {
                    throw new Error(
                        `Table ${table.name}: One-to-many relation '${relation.propertyKey}' has inverseSide '${relation.inverseSide}' which is not many-to-one`,
                    );
                }
                if (
                    relation.type === 'many-to-one' &&
                    inverseRelation.type !== 'one-to-many'
                ) {
                    throw new Error(
                        `Table ${table.name}: Many-to-one relation '${relation.propertyKey}' has inverseSide '${relation.inverseSide}' which is not one-to-many`,
                    );
                }
            }
        }
    }
}

function checkCircularDependencies(tables: OrmTableMetadata[]): void {
    // Build dependency graph based on foreign keys
    const dependencies = new Map<string, Set<string>>();

    for (const table of tables) {
        if (!dependencies.has(table.name)) {
            dependencies.set(table.name, new Set());
        }

        for (const relation of table.relations) {
            if (
                relation.type === 'many-to-one' ||
                relation.type === 'one-to-one'
            ) {
                const targetCtor = relation.target();
                const targetMeta = ormGetTable(targetCtor);

                if (targetMeta) {
                    // This table depends on the target table (has a foreign key to it)
                    dependencies.get(table.name)!.add(targetMeta.name);
                }
            }
        }
    }

    // Check for circular dependencies using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    function hasCycle(tableName: string, path: string[] = []): boolean {
        if (recursionStack.has(tableName)) {
            // Found a cycle
            const cycleStart = path.indexOf(tableName);
            const cycle = [...path.slice(cycleStart), tableName];
            throw new Error(
                `Circular dependency detected: ${cycle.join(' -> ')}`,
            );
        }

        if (visited.has(tableName)) {
            return false;
        }

        visited.add(tableName);
        recursionStack.add(tableName);

        const deps = dependencies.get(tableName);
        if (deps) {
            for (const dep of deps) {
                hasCycle(dep, [...path, tableName]);
            }
        }

        recursionStack.delete(tableName);
        return false;
    }

    // Check each table for cycles
    for (const table of tables) {
        if (!visited.has(table.name)) {
            hasCycle(table.name);
        }
    }
}
