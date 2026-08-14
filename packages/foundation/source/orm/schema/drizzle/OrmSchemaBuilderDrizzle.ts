// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */
import { relations } from 'drizzle-orm';

import type { OrmColumnType } from '../../interfaces/OrmColumnType';
import type { OrmIndexColumn } from '../../interfaces/OrmIndexColumn';
import { ormIndexColumnName } from '../../interfaces/OrmIndexColumn';
import type { OrmColumnMetadata } from '../../metadata/OrmColumnMetadata';
import { isColumnPrimaryKey } from '../../metadata/OrmPrimaryKeyInfo';
import { ormGetTable } from '../../metadata/OrmSchemaRegistry';
import type { OrmTableMetadata } from '../../metadata/OrmTableMetadata';
import { getPrimaryKeyPropertyKeys } from '../../metadata/OrmTableMetadata';
import type { OrmSchemaBuilder } from '../OrmSchemaBuilder';
import { checkTableSchema } from '../OrmSchemaCheck';
import { isColumnKind } from '../OrmSchemaHelpers';

export type OrmSchemaBuilderDrizzleColumns = [any, ...any[]];

/**
 * Dual-output product of each builder primitive: the runtime drizzle
 * value (column builder, constraint, etc.) AND its source-code
 * representation. The same code path produces both, so they're
 * structurally guaranteed to stay in sync.
 *
 * `helpers` carries the set of drizzle-orm helper names the source
 * snippet uses (e.g. `'integer'`, `'primaryKey'`) so the assembled
 * file can emit a minimal import line.
 */
export interface DrizzleEmitted<T = any> {
    runtime: T;
    source: string;
    helpers: Set<string>;
}

export abstract class OrmSchemaBuilderDrizzle implements OrmSchemaBuilder {
    protected readonly schema: Record<string, any> = {}; // Mixed schema with tables and relations
    private readonly tableSources: string[] = [];
    protected readonly usedHelpers = new Set<string>();

    /**
     * Set when an emitted index column used drizzle's core `sql` helper
     * (today, a prefix-indexed column). `sql` is a drizzle-orm core
     * export, not a dialect one, so the generated file needs a separate
     * import line for it.
     */
    protected usesCoreSqlHelper = false;

    constructor() {}

    /**
     * Drizzle import specifier — `'drizzle-orm/sqlite-core'` or
     * `'drizzle-orm/mysql-core'`. Subclasses override.
     */
    protected abstract get dialectImportPath(): string;

    /**
     * Helper function name used to construct tables — `'sqliteTable'`
     * or `'mysqlTable'`. Subclasses override.
     */
    protected abstract get tableHelperName(): string;

    // Abstract methods for dialect-specific implementations
    protected abstract createDialectTable(
        name: string,
        columns: Record<string, any>,
        constraints?: (table: any) => any[],
    ): any;

    protected abstract createPrimaryKeyConstraint(config: {
        name?: string;
        columns: OrmSchemaBuilderDrizzleColumns;
    }): DrizzleEmitted;

    protected abstract createIndex(
        name: string,
        columns: OrmSchemaBuilderDrizzleColumns,
    ): DrizzleEmitted;

    protected abstract createUniqueIndex(
        name: string,
        columns: OrmSchemaBuilderDrizzleColumns,
    ): DrizzleEmitted;

    protected abstract createUniqueConstraint(
        name: string | undefined,
        columns: OrmSchemaBuilderDrizzleColumns,
    ): DrizzleEmitted;

    // Abstract column creation methods
    protected abstract createIntegerColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'integer' }>;
        },
    ): DrizzleEmitted;

    protected abstract createBigIntColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'bigint' }>;
        },
    ): DrizzleEmitted;

    protected abstract createFloatColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'float' }>;
        },
    ): DrizzleEmitted;

    protected abstract createDoubleColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'double' }>;
        },
    ): DrizzleEmitted;

    protected abstract createDecimalColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'decimal' }>;
        },
    ): DrizzleEmitted;

    protected abstract createBooleanColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'boolean' }>;
        },
    ): DrizzleEmitted;

    protected abstract createCharColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'char' }>;
        },
    ): DrizzleEmitted;

    protected abstract createVarcharColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'varchar' }>;
        },
    ): DrizzleEmitted;

    protected abstract createTextColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'text' }>;
        },
    ): DrizzleEmitted;

    protected abstract createBytesColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'bytes' }>;
        },
    ): DrizzleEmitted;

    protected abstract createDatetimeColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'datetime' }>;
        },
    ): DrizzleEmitted;

    protected abstract createUuidColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'uuid' }>;
        },
    ): DrizzleEmitted;

    protected abstract createJsonColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'json' }>;
        },
    ): DrizzleEmitted;

    protected abstract createEnumColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'enum' }>;
        },
    ): DrizzleEmitted;

    /**
     * Dialect-specific limits that make an otherwise well-formed schema
     * impossible to apply — checked across all entities before any table
     * is built, so the report names every offender instead of dying on
     * the first.
     *
     * The base implementation permits everything; a dialect overrides it
     * to enforce what its engine will actually accept.
     *
     * Returns human-readable violations. An empty array means no
     * objection.
     */
    protected validateDialectConstraints(
        _entities: OrmTableMetadata[],
    ): string[] {
        return [];
    }

    /**
     * Resolves one index column against the constructed table.
     *
     * The base implementation ignores any declared prefix length and
     * indexes the whole column, which is right for dialects that have no
     * prefix syntax (SQLite indexes a TEXT column entire and has no
     * key-length ceiling to work around). MySQL overrides this to emit
     * `col(n)`.
     */
    protected resolveIndexColumn(indexColumn: OrmIndexColumn, table: any): any {
        return table[ormIndexColumnName(indexColumn)];
    }

    /**
     * The generated-source form of one index column.
     *
     * Mirrors `resolveIndexColumn` for the emitted `schema.generated.ts`:
     * the two must agree, because the runtime schema and the file
     * drizzle-kit reads have to describe the same index. The base form
     * ignores prefixes, matching the base `resolveIndexColumn`.
     */
    protected indexColumnSource(indexColumn: OrmIndexColumn): string {
        return `table.${safeIdentifier(ormIndexColumnName(indexColumn))}`;
    }

    createSchema(entities: OrmTableMetadata[]): Record<string, any> {
        // Reject a schema the dialect cannot accept before emitting
        // anything. Catching this here — offline, with no database
        // connection — is the difference between a legible error at
        // generate time and a migration that half-applies against a live
        // database and reports nothing.
        const violations = this.validateDialectConstraints(entities);
        if (violations.length > 0) {
            throw new Error(
                `Schema cannot be applied to this database engine:\n\n${violations.join('\n')}\n`,
            );
        }

        // First pass: create all tables
        for (const entity of entities) {
            this.createTable(entity);
        }

        // Second pass: create all relations
        for (const entity of entities) {
            this.createRelations(entity);
        }

        return this.schema;
    }

    /**
     * After `createSchema()` runs, returns the assembled pure-drizzle
     * source representation of the same schema. Used by the CLI to
     * write `schema.generated.ts` — drizzle-kit then reads the file
     * directly with no foundation dependency in its loader path.
     *
     * Includes the dialect-specific import line (sqlite-core or
     * mysql-core) trimmed to only the helpers actually referenced by
     * the generated tables.
     *
     * Relations and join-table relations are intentionally NOT emitted:
     * drizzle-kit's migration generation only needs table definitions
     * for SQL DDL. Drizzle's `relations()` are a runtime query-builder
     * concept that don't affect the database schema.
     */
    getEmittedSource(): string {
        this.usedHelpers.add(this.tableHelperName);
        // getCustomTypeDefinitions can mutate usedHelpers (e.g. swap
        // 'customDateTime' for 'customType') so call it before sorting.
        const customTypes = this.getCustomTypeDefinitions();
        const sortedHelpers = [...this.usedHelpers].sort();
        const importLine = `import { ${sortedHelpers.join(', ')} } from '${this.dialectImportPath}';`;
        // `sql` is a drizzle-orm core export, not a dialect one, so it
        // needs its own import line — and only when something actually
        // emitted it (today, a prefix-indexed column).
        const coreImportLine = this.usesCoreSqlHelper
            ? `\nimport { sql } from 'drizzle-orm';`
            : '';
        const header = `// Generated by \`base orm schema:diff\`. Do not edit by hand.
// Regenerate by changing your entities and re-running schema:diff.

`;
        const preamble = customTypes ? `\n${customTypes}\n` : '';
        return `${header}${importLine}${coreImportLine}\n${preamble}\n${this.tableSources.join('\n\n')}\n`;
    }

    /**
     * Hook for subclasses to inject local `customType` definitions
     * (e.g. SQLite's `customDateTime` to round-trip Date ↔ ISO string)
     * into the emitted source. May mutate `usedHelpers` — swap a
     * sentinel helper out for the real drizzle import it depends on.
     * Returns the empty string when no custom types are needed.
     */
    protected getCustomTypeDefinitions(): string {
        return '';
    }

    private createTable(tableMeta: OrmTableMetadata): void {
        checkTableSchema(tableMeta, 'mysql');

        // Build emitted columns (runtime + source) for each declared column.
        const emittedCols: Record<string, DrizzleEmitted> = {};

        for (const columnMeta of tableMeta.columns) {
            const colName = columnMeta.options?.name ?? columnMeta.propertyKey;
            const emitted = this.createColumn(colName, columnMeta, tableMeta);
            emittedCols[columnMeta.propertyKey] = emitted;
            this.trackHelpers(emitted);
        }

        const runtimeCols: Record<string, any> = {};
        for (const [propKey, emitted] of Object.entries(emittedCols)) {
            runtimeCols[propKey] = emitted.runtime;
        }

        // Constraint builders (runtime functions taking the constructed
        // table) and their source representations are produced together.
        const constraintFunctions = this.buildTableConstraints(tableMeta);

        const runtimeConstraints = constraintFunctions.map((c) => c.runtime);
        const sourceConstraints = constraintFunctions
            .map((c) => c.source)
            .filter((s): s is string => !!s);

        const table =
            constraintFunctions.length > 0
                ? this.createDialectTable(tableMeta.name, runtimeCols, (t) => {
                      return runtimeConstraints
                          .map((fn) => fn(t))
                          .filter((c) => c !== undefined);
                  })
                : this.createDialectTable(tableMeta.name, runtimeCols);

        this.schema[tableMeta.name] = table;

        // Assemble the source export for this table.
        const colsSource = Object.entries(emittedCols)
            .map(
                ([propKey, e]) => `    ${safeIdentifier(propKey)}: ${e.source}`,
            )
            .join(',\n');

        const extrasSource = sourceConstraints.length
            ? `, (table) => [\n${sourceConstraints.map((s) => `    ${s}`).join(',\n')},\n]`
            : '';

        const exportName = safeIdentifier(tableMeta.name);
        this.tableSources.push(
            `export const ${exportName} = ${this.tableHelperName}('${tableMeta.name}', {\n${colsSource},\n}${extrasSource});`,
        );
    }

    private buildTableConstraints(tableMeta: OrmTableMetadata): Array<{
        runtime: (table: any) => any;
        source?: string;
    }> {
        const constraints: Array<{
            runtime: (table: any) => any;
            source?: string;
        }> = [];

        // Handle composite primary key
        if (tableMeta.primaryKey?.type === 'composite') {
            const pkInfo = tableMeta.primaryKey;
            const propKeys = pkInfo.columns;
            const pkEmitted = this.createPrimaryKeyConstraint({
                name: pkInfo.name,
                columns: propKeys.map(
                    (k) => `__TABLE_REF__${k}`,
                ) as unknown as OrmSchemaBuilderDrizzleColumns,
            });
            this.trackHelpers(pkEmitted);

            let source = pkEmitted.source;
            for (const k of propKeys) {
                source = source.replace(
                    `__TABLE_REF__${k}`,
                    `table.${safeIdentifier(k)}`,
                );
            }

            constraints.push({
                runtime: (table) => {
                    if (tableMeta.primaryKey?.type !== 'composite') {
                        return undefined;
                    }
                    const pkCols = tableMeta.primaryKey.columns
                        .map((c) => table[c])
                        .filter((c) => c !== undefined);
                    if (pkCols.length === 0) {
                        throw new Error(
                            `Composite primary key on '${tableMeta.name}' resolved to no columns (declared: ${tableMeta.primaryKey.columns.join(', ')}). A silently-dropped primary key would corrupt upsert/dedup behavior.`,
                        );
                    }
                    return this.createPrimaryKeyConstraint({
                        ...(tableMeta.primaryKey.name && {
                            name: tableMeta.primaryKey.name,
                        }),
                        columns: pkCols as [any, ...any[]],
                    }).runtime;
                },
                source,
            });
        }

        // Handle table indexes
        if (tableMeta.indexes && tableMeta.indexes.length > 0) {
            for (const indexMeta of tableMeta.indexes) {
                if (!indexMeta.name) {
                    throw new Error(
                        `Index on columns [${indexMeta.columns.map(ormIndexColumnName).join(', ')}] in table ${tableMeta.name} has no name. This should have been generated during metadata merge.`,
                    );
                }
                const propKeys = indexMeta.columns.map(ormIndexColumnName);
                const indexEmitted = indexMeta.options?.unique
                    ? this.createUniqueIndex(
                          indexMeta.name,
                          propKeys.map(
                              (k) => `__TABLE_REF__${k}`,
                          ) as unknown as OrmSchemaBuilderDrizzleColumns,
                      )
                    : this.createIndex(
                          indexMeta.name,
                          propKeys.map(
                              (k) => `__TABLE_REF__${k}`,
                          ) as unknown as OrmSchemaBuilderDrizzleColumns,
                      );
                this.trackHelpers(indexEmitted);

                let source = indexEmitted.source;
                for (const indexColumn of indexMeta.columns) {
                    const propertyKey = ormIndexColumnName(indexColumn);
                    source = source.replace(
                        `__TABLE_REF__${propertyKey}`,
                        this.indexColumnSource(indexColumn),
                    );
                }

                constraints.push({
                    runtime: (table) => {
                        const cols = indexMeta.columns
                            .map((indexColumn) =>
                                this.resolveIndexColumn(indexColumn, table),
                            )
                            .filter((c) => c !== undefined);
                        if (cols.length === 0) {
                            throw new Error(
                                `Index '${indexMeta.name || 'unnamed'}' on '${tableMeta.name}' resolved to no columns (declared: ${indexMeta.columns.map(ormIndexColumnName).join(', ')}).`,
                            );
                        }
                        const colsArr = cols as [any, ...any[]];
                        if (indexMeta.options?.unique) {
                            return this.createUniqueIndex(
                                indexMeta.name!,
                                colsArr,
                            ).runtime;
                        }
                        return this.createIndex(indexMeta.name!, colsArr)
                            .runtime;
                    },
                    source,
                });
            }
        }

        // Handle unique constraints (composite)
        if (
            tableMeta.uniqueConstraints &&
            tableMeta.uniqueConstraints.length > 0
        ) {
            for (const uniqueMeta of tableMeta.uniqueConstraints) {
                const propKeys = uniqueMeta.columns;
                const uniqueEmitted = this.createUniqueConstraint(
                    uniqueMeta.name,
                    propKeys.map(
                        (k) => `__TABLE_REF__${k}`,
                    ) as unknown as OrmSchemaBuilderDrizzleColumns,
                );
                this.trackHelpers(uniqueEmitted);

                let source = uniqueEmitted.source;
                for (const k of propKeys) {
                    source = source.replace(
                        `__TABLE_REF__${k}`,
                        `table.${safeIdentifier(k)}`,
                    );
                }

                constraints.push({
                    runtime: (table) => {
                        const cols = uniqueMeta.columns
                            .map((c) => table[c])
                            .filter((c) => c !== undefined);
                        if (cols.length === 0) {
                            throw new Error(
                                `Unique constraint '${uniqueMeta.name || 'unnamed'}' on '${tableMeta.name}' resolved to no columns (declared: ${uniqueMeta.columns.join(', ')}).`,
                            );
                        }
                        return this.createUniqueConstraint(
                            uniqueMeta.name,
                            cols as [any, ...any[]],
                        ).runtime;
                    },
                    source,
                });
            }
        }

        // TODO: Add check constraints
        // TODO: Add foreign key constraints

        return constraints;
    }

    private createRelations(tableMeta: OrmTableMetadata): void {
        if (tableMeta.relations.length === 0) return;

        const table = this.schema[tableMeta.name];
        if (!table) return;

        const relationName = `${tableMeta.name}Relations`;
        this.schema[relationName] = relations(table, ({ one, many }) => {
            const relationConfig: Record<string, any> = {};

            for (const relation of tableMeta.relations) {
                const targetCtor = relation.target();

                // Get target metadata to find the actual table name
                const targetMeta = ormGetTable(targetCtor);
                if (!targetMeta) {
                    throw new Error(
                        `Relation '${relation.propertyKey}' on '${tableMeta.name}' targets ${targetCtor.name}, which is not registered as an @OrmTable.`,
                    );
                }

                // Lenient on purpose: the target is a real entity but isn't in
                // this schema's entity set (e.g. a partial schema build). Skip
                // the relation rather than failing the whole build.
                const targetTable = this.schema[targetMeta.name];
                if (!targetTable) continue;

                switch (relation.type) {
                    case 'many-to-one':
                    case 'one-to-one': {
                        // Check if there's a custom join column configuration
                        const joinColumnOptions =
                            tableMeta.joinColumns?.[relation.propertyKey];
                        const joinColumnName =
                            joinColumnOptions?.name || relation.joinColumn;

                        // Find the property key for this column
                        // It could be specified as either a property name or a database column name
                        let joinColPropertyKey: string | undefined;

                        // First check if it matches a property name directly
                        if (
                            tableMeta.columns.some(
                                (col) => col.propertyKey === joinColumnName,
                            )
                        ) {
                            joinColPropertyKey = joinColumnName;
                        } else {
                            // Otherwise check if it matches a database column name
                            for (const col of tableMeta.columns) {
                                const dbName =
                                    col.options?.name || col.propertyKey;
                                if (dbName === joinColumnName) {
                                    joinColPropertyKey = col.propertyKey;
                                    break;
                                }
                            }
                        }

                        if (!joinColPropertyKey) {
                            if (
                                relation.type === 'one-to-one' &&
                                relation.inverseSide
                            ) {
                                // Inverse side of a one-to-one: the foreign
                                // key lives on the target table. A config-less
                                // one() is how Drizzle models the non-owning
                                // side — normalizeRelation resolves it by
                                // reversing the owning side's fields. (Drizzle
                                // rejects a config without fields, so the
                                // pairing relies on this being the only
                                // relation from the target back to this
                                // table.)
                                relationConfig[relation.propertyKey] =
                                    one(targetTable);
                                break;
                            }
                            throw new Error(
                                `Relation '${relation.propertyKey}' on '${tableMeta.name}' declares join column '${joinColumnName}', which is not a column (neither a property name nor a database column name).`,
                            );
                        }

                        // Get the join column from our table using the property key
                        const joinCol = (table as any)[joinColPropertyKey];
                        if (!joinCol) {
                            throw new Error(
                                `Join column '${joinColPropertyKey}' for relation '${relation.propertyKey}' was not found on table '${tableMeta.name}'.`,
                            );
                        }

                        // Get the referenced column name (default to primary key)
                        const referencedColumnName =
                            joinColumnOptions?.referencedColumnName;

                        // Get the primary key columns from target metadata
                        const pkColumns = referencedColumnName
                            ? [referencedColumnName]
                            : getPrimaryKeyPropertyKeys(targetMeta);

                        if (pkColumns.length === 0) {
                            throw new Error(
                                `Relation '${relation.propertyKey}' on '${tableMeta.name}' references target '${targetMeta.name}', which has no primary key to join on.`,
                            );
                        }

                        // For now, use the first primary key column
                        const targetPkCol = (targetTable as any)[pkColumns[0]];
                        if (!targetPkCol) {
                            throw new Error(
                                `Referenced column '${pkColumns[0]}' was not found on target table '${targetMeta.name}' for relation '${relation.propertyKey}' of '${tableMeta.name}'.`,
                            );
                        }

                        relationConfig[relation.propertyKey] = one(
                            targetTable,
                            {
                                fields: [joinCol],
                                references: [targetPkCol],
                                // Disambiguates multiple relations between
                                // the same pair of tables (e.g. a
                                // self-referential parent/children pair).
                                // The inverse one-to-many derives the same
                                // name from its inverseSide.
                                relationName: `${tableMeta.name}_${relation.propertyKey}`,
                            },
                        );
                        break;
                    }
                    case 'one-to-many':
                        relationConfig[relation.propertyKey] = many(
                            targetTable,
                            {
                                relationName: `${targetMeta.name}_${relation.inverseSide}`,
                            },
                        );
                        break;
                }
            }

            return relationConfig;
        });
    }

    protected trackHelpers(emitted: DrizzleEmitted): void {
        for (const h of emitted.helpers) {
            this.usedHelpers.add(h);
        }
    }

    private createColumn(
        name: string,
        meta: OrmColumnMetadata,
        tableMeta: OrmTableMetadata,
    ): DrizzleEmitted {
        let emitted: DrizzleEmitted;

        if (isColumnKind(meta, 'integer')) {
            emitted = this.createIntegerColumn(name, meta);
        } else if (isColumnKind(meta, 'bigint')) {
            emitted = this.createBigIntColumn(name, meta);
        } else if (isColumnKind(meta, 'float')) {
            emitted = this.createFloatColumn(name, meta);
        } else if (isColumnKind(meta, 'double')) {
            emitted = this.createDoubleColumn(name, meta);
        } else if (isColumnKind(meta, 'decimal')) {
            emitted = this.createDecimalColumn(name, meta);
        } else if (isColumnKind(meta, 'boolean')) {
            emitted = this.createBooleanColumn(name, meta);
        } else if (isColumnKind(meta, 'char')) {
            emitted = this.createCharColumn(name, meta);
        } else if (isColumnKind(meta, 'varchar')) {
            emitted = this.createVarcharColumn(name, meta);
        } else if (isColumnKind(meta, 'text')) {
            emitted = this.createTextColumn(name, meta);
        } else if (isColumnKind(meta, 'bytes')) {
            emitted = this.createBytesColumn(name, meta);
        } else if (isColumnKind(meta, 'datetime')) {
            emitted = this.createDatetimeColumn(name, meta);
        } else if (isColumnKind(meta, 'uuid')) {
            emitted = this.createUuidColumn(name, meta);
        } else if (isColumnKind(meta, 'json')) {
            emitted = this.createJsonColumn(name, meta);
        } else if (isColumnKind(meta, 'enum')) {
            emitted = this.createEnumColumn(name, meta);
        } else {
            throw new Error(`Unsupported column type: ${meta.type}`);
        }

        if (meta.options?.nullable !== true) {
            emitted = {
                runtime: emitted.runtime.notNull(),
                source: emitted.source + '.notNull()',
                helpers: emitted.helpers,
            };
        }

        // Only add primaryKey() for single-column primary keys
        // Composite primary keys are handled at the table level
        const isPK = isColumnPrimaryKey(tableMeta.primaryKey, meta.propertyKey);
        const isCompositePK = tableMeta.primaryKey?.type === 'composite';

        if (isPK && !isCompositePK) {
            emitted = {
                runtime: emitted.runtime.primaryKey(),
                source: emitted.source + '.primaryKey()',
                helpers: emitted.helpers,
            };
        }

        if (meta.options?.unique === true) {
            emitted = {
                runtime: emitted.runtime.unique(),
                source: emitted.source + '.unique()',
                helpers: emitted.helpers,
            };
        }

        // Handle default values
        if (meta.options?.default !== undefined) {
            const def = meta.options.default;
            if (typeof def === 'function') {
                // Function defaults: use Drizzle's $defaultFn (application-level, not SQL DDL)
                // This ensures defaults are applied even when inserting via the database directly
                emitted = {
                    runtime: (emitted.runtime as any).$defaultFn(def),
                    source: emitted.source + `.$defaultFn(${serializeFn(def)})`,
                    helpers: emitted.helpers,
                };
            } else {
                // Static defaults: emit SQL-level DEFAULT clause (needed for ALTER TABLE ADD COLUMN NOT NULL)
                const value =
                    columnUsesBigIntMode(meta) &&
                    (typeof def === 'number' || typeof def === 'string')
                        ? BigInt(def)
                        : def;
                emitted = {
                    runtime: (emitted.runtime as any).default(value),
                    source:
                        emitted.source +
                        `.default(${serializeStaticDefault(value)})`,
                    helpers: emitted.helpers,
                };
            }
        }

        return emitted;
    }
}

/**
 * Coerce a string to a valid TypeScript identifier so we can use it as
 * an `export const` name or object property key without quotes. Drops
 * non-`[A-Za-z0-9_$]` characters and prefixes with `_` if the first
 * char isn't a valid identifier start.
 *
 * Table names like `user_roles` pass through; names containing
 * hyphens or starting with digits get sanitized.
 */
function safeIdentifier(name: string): string {
    let s = name.replace(/[^A-Za-z0-9_$]/g, '_');
    if (!/^[A-Za-z_$]/.test(s)) {
        s = '_' + s;
    }
    return s;
}

/**
 * Serialize a JS function to its source-code form for embedding into
 * the generated drizzle schema. Works for arrow lambdas and plain
 * functions whose bodies don't capture closure variables (which is
 * the normal case for default-value generators on entity columns).
 *
 * Captured closures are not faithfully reproducible — but in
 * practice, defaults like `() => crypto.randomUUID()` or
 * `() => new Date()` are self-contained.
 */
function serializeFn(fn: (...args: never[]) => unknown): string {
    return fn.toString();
}

/**
 * `mode` is required on bigint, decimal, and datetime columns — the type
 * system enforces it for TypeScript consumers; this guards JavaScript
 * callers and stale metadata with the same loud failure at
 * schema-build time instead of silently picking a representation.
 */
export function requireColumnMode<ModeType extends string>(
    meta: OrmColumnMetadata,
    allowedModes: readonly ModeType[],
): ModeType {
    const mode = (meta.type as { mode?: ModeType }).mode;
    if (mode === undefined || !allowedModes.includes(mode)) {
        throw new Error(
            `${meta.type.kind} column '${meta.propertyKey}' must declare mode: ` +
                allowedModes.map((m) => `'${m}'`).join(' | ') +
                ` — the framework will not guess which representation is safe.`,
        );
    }
    return mode;
}

/**
 * Whether a column maps to a bigint-mode drizzle builder — MySQL
 * `bigint`/`decimal` with `mode: 'bigint'`, SQLite `blob` with
 * `mode: 'bigint'` — whose `.default()` is typed `bigint`, not `number`.
 * Static defaults on these columns must be passed (and emitted) as
 * BigInt: `.default(0)` fails to typecheck in the generated schema
 * where `.default(0n)` doesn't.
 */
function columnUsesBigIntMode(meta: OrmColumnMetadata): boolean {
    const type = meta.type;
    return (
        (type.kind === 'bigint' && type.mode === 'bigint') ||
        (type.kind === 'decimal' && type.mode === 'bigint')
    );
}

/**
 * Serialize a static default value for embedding into the generated
 * drizzle schema. BigInts become `123n` literals (`JSON.stringify`
 * throws on them); everything else round-trips through JSON.
 */
function serializeStaticDefault(value: unknown): string {
    return typeof value === 'bigint' ? `${value}n` : JSON.stringify(value);
}
