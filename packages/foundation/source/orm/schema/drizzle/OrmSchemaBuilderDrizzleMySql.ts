// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

import { sql } from 'drizzle-orm';
import {
    bigint,
    binary,
    boolean,
    char,
    datetime,
    decimal,
    double,
    float,
    index,
    int,
    json,
    longtext,
    mediumint,
    mediumtext,
    mysqlEnum,
    mysqlTable,
    primaryKey,
    smallint,
    text,
    tinyint,
    tinytext,
    unique,
    uniqueIndex,
    varbinary,
    varchar,
} from 'drizzle-orm/mysql-core';

import { OrmColumnType } from '../../interfaces/OrmColumnType';
import {
    OrmIndexColumn,
    ormIndexColumnName,
    ormIndexColumnPrefixLength,
} from '../../interfaces/OrmIndexColumn';
import { OrmColumnMetadata } from '../../metadata/OrmColumnMetadata';
import { OrmTableMetadata } from '../../metadata/OrmTableMetadata';
import {
    formatIndexKeyLengthFindings,
    ormCheckIndexKeyLength,
} from '../OrmCheckIndexKeyLength';
import { ormEnumStringValues } from '../OrmSchemaHelpers';
import {
    DrizzleEmitted,
    OrmSchemaBuilderDrizzle,
    OrmSchemaBuilderDrizzleColumns,
    requireColumnMode,
} from './OrmSchemaBuilderDrizzle';

export class OrmSchemaBuilderDrizzleMySql extends OrmSchemaBuilderDrizzle {
    protected get dialectImportPath(): string {
        return 'drizzle-orm/mysql-core';
    }

    protected get tableHelperName(): string {
        return 'mysqlTable';
    }

    /**
     * InnoDB refuses an index key wider than 3072 bytes. Nothing upstream
     * of here knows that: the decorators accept `@OrmTableIndex(['title'])`
     * without consulting the column's declared length, and every layer
     * after this one produces syntactically valid output. MySQL is the
     * first thing in the chain to object, and by then the statement is
     * running against a real database mid-migration.
     *
     * SQLite has no equivalent limit, which is why this lives on the
     * MySQL builder rather than the shared base.
     */
    protected override validateDialectConstraints(
        entities: OrmTableMetadata[],
    ): string[] {
        const findings = entities.flatMap((entity) =>
            ormCheckIndexKeyLength(entity),
        );

        if (findings.length === 0) {
            return [];
        }

        return [formatIndexKeyLengthFindings(findings)];
    }

    /**
     * Emits `col(n)` for a prefix-indexed column.
     *
     * Drizzle has no prefix-index API — `IndexColumn` is
     * `MySqlColumn | SQL` — so the prefix can only be expressed as a raw
     * SQL fragment, which drizzle-kit serializes verbatim into the
     * `CREATE INDEX`. (It also demands an explicit index name for
     * expression columns; ours are always named.)
     */
    protected override resolveIndexColumn(
        indexColumn: OrmIndexColumn,
        table: any,
    ): any {
        const columnName = ormIndexColumnName(indexColumn);
        const prefixLength = ormIndexColumnPrefixLength(indexColumn);
        const column = table[columnName];

        if (prefixLength === undefined || column === undefined) {
            return column;
        }

        return sql`${column}(${sql.raw(String(prefixLength))})`;
    }

    protected override indexColumnSource(indexColumn: OrmIndexColumn): string {
        const columnSource = super.indexColumnSource(indexColumn);
        const prefixLength = ormIndexColumnPrefixLength(indexColumn);

        if (prefixLength === undefined) {
            return columnSource;
        }

        this.usesCoreSqlHelper = true;
        return `sql\`\${${columnSource}}(\${sql.raw('${prefixLength}')})\``;
    }

    protected createDialectTable(
        name: string,
        columns: Record<string, any>,
        constraints?: (table: any) => any[],
    ) {
        return mysqlTable(name, columns, constraints);
    }

    protected createPrimaryKeyConstraint(config: {
        name?: string;
        columns: OrmSchemaBuilderDrizzleColumns;
    }): DrizzleEmitted {
        const colsSource = config.columns
            .map((c) => (typeof c === 'string' ? c : '/* col */'))
            .join(', ');
        const nameSource = config.name ? `, name: '${config.name}'` : '';
        return {
            runtime: primaryKey(config),
            source: `primaryKey({ columns: [${colsSource}]${nameSource} })`,
            helpers: new Set(['primaryKey']),
        };
    }

    protected createIndex(
        name: string,
        columns: OrmSchemaBuilderDrizzleColumns,
    ): DrizzleEmitted {
        const colsSource = columns
            .map((c) => (typeof c === 'string' ? c : '/* col */'))
            .join(', ');
        return {
            runtime: index(name).on(...columns),
            source: `index('${name}').on(${colsSource})`,
            helpers: new Set(['index']),
        };
    }

    protected createUniqueIndex(
        name: string,
        columns: OrmSchemaBuilderDrizzleColumns,
    ): DrizzleEmitted {
        const colsSource = columns
            .map((c) => (typeof c === 'string' ? c : '/* col */'))
            .join(', ');
        return {
            runtime: uniqueIndex(name).on(...columns),
            source: `uniqueIndex('${name}').on(${colsSource})`,
            helpers: new Set(['uniqueIndex']),
        };
    }

    protected createUniqueConstraint(
        name: string | undefined,
        columns: OrmSchemaBuilderDrizzleColumns,
    ): DrizzleEmitted {
        const colsSource = columns
            .map((c) => (typeof c === 'string' ? c : '/* col */'))
            .join(', ');
        const nameSource = name ? `'${name}'` : '';
        return {
            runtime: unique(name).on(...columns),
            source: `unique(${nameSource}).on(${colsSource})`,
            helpers: new Set(['unique']),
        };
    }

    protected createIntegerColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'integer' }>;
        },
    ): DrizzleEmitted {
        const unsignedOpt = meta.type.unsigned
            ? `{ unsigned: ${meta.type.unsigned} }`
            : '';
        const argList = unsignedOpt ? `'${name}', ${unsignedOpt}` : `'${name}'`;
        let fn: string;
        let intBuilder: any;
        switch (meta.type.size) {
            case 'int8':
                fn = 'tinyint';
                intBuilder = tinyint(name, { unsigned: meta.type.unsigned });
                break;
            case 'int16':
                fn = 'smallint';
                intBuilder = smallint(name, { unsigned: meta.type.unsigned });
                break;
            case 'int24':
                fn = 'mediumint';
                intBuilder = mediumint(name, { unsigned: meta.type.unsigned });
                break;
            case 'int32':
            case undefined:
                fn = 'int';
                intBuilder = int(name, { unsigned: meta.type.unsigned });
                break;
        }

        let source = `${fn}(${argList})`;

        if (meta.type.increment === true) {
            intBuilder.autoincrement();
            source += '.autoincrement()';
        }

        return {
            runtime: intBuilder,
            source,
            helpers: new Set([fn]),
        };
    }

    protected createBigIntColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'bigint' }>;
        },
    ): DrizzleEmitted {
        const mode = requireColumnMode(meta, ['number', 'bigint']);
        const opts: string[] = [`mode: '${mode}'`];
        if (meta.type.unsigned) {
            opts.push(`unsigned: ${meta.type.unsigned}`);
        }
        const bigintBuilder = bigint(name, {
            mode,
            unsigned: meta.type.unsigned,
        });
        let source = `bigint('${name}', { ${opts.join(', ')} })`;

        if (meta.type.increment === true) {
            bigintBuilder.autoincrement();
            source += '.autoincrement()';
        }

        return {
            runtime: bigintBuilder,
            source,
            helpers: new Set(['bigint']),
        };
    }

    protected createFloatColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'float' }>;
        },
    ): DrizzleEmitted {
        const opts = floatOptsSource(meta);
        return {
            runtime: float(name, {
                precision: meta.type.precision,
                scale: meta.type.scale,
                unsigned: meta.type.unsigned,
            }),
            source: opts ? `float('${name}', ${opts})` : `float('${name}')`,
            helpers: new Set(['float']),
        };
    }

    protected createDoubleColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'double' }>;
        },
    ): DrizzleEmitted {
        const opts = floatOptsSource(meta);
        return {
            runtime: double(name, {
                precision: meta.type.precision,
                scale: meta.type.scale,
                unsigned: meta.type.unsigned,
            }),
            source: opts ? `double('${name}', ${opts})` : `double('${name}')`,
            helpers: new Set(['double']),
        };
    }

    protected createDecimalColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'decimal' }>;
        },
    ): DrizzleEmitted {
        const mode = requireColumnMode(meta, ['string', 'number', 'bigint']);
        const opts: string[] = [`mode: '${mode}'`];
        if (meta.type.precision !== undefined) {
            opts.push(`precision: ${meta.type.precision}`);
        }
        if (meta.type.scale !== undefined) {
            opts.push(`scale: ${meta.type.scale}`);
        }
        if (meta.type.unsigned) {
            opts.push(`unsigned: ${meta.type.unsigned}`);
        }
        return {
            runtime: decimal(name, {
                precision: meta.type.precision,
                scale: meta.type.scale,
                unsigned: meta.type.unsigned,
                mode,
            }),
            source: `decimal('${name}', { ${opts.join(', ')} })`,
            helpers: new Set(['decimal']),
        };
    }

    protected createBooleanColumn(
        name: string,
        _meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'boolean' }>;
        },
    ): DrizzleEmitted {
        return {
            runtime: boolean(name),
            source: `boolean('${name}')`,
            helpers: new Set(['boolean']),
        };
    }

    protected createCharColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'char' }>;
        },
    ): DrizzleEmitted {
        return {
            runtime: char(name, { length: meta.type.length }),
            source: `char('${name}', { length: ${meta.type.length} })`,
            helpers: new Set(['char']),
        };
    }

    protected createVarcharColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'varchar' }>;
        },
    ): DrizzleEmitted {
        return {
            runtime: varchar(name, { length: meta.type.length }),
            source: `varchar('${name}', { length: ${meta.type.length} })`,
            helpers: new Set(['varchar']),
        };
    }

    protected createTextColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'text' }>;
        },
    ): DrizzleEmitted {
        let fn: string;
        let runtime: any;
        switch (meta.type.size) {
            case 'tiny':
                fn = 'tinytext';
                runtime = tinytext(name);
                break;
            case 'medium':
                fn = 'mediumtext';
                runtime = mediumtext(name);
                break;
            case 'long':
                fn = 'longtext';
                runtime = longtext(name);
                break;
            case undefined:
                fn = 'text';
                runtime = text(name);
                break;
        }
        return {
            runtime,
            source: `${fn}('${name}')`,
            helpers: new Set([fn]),
        };
    }

    protected createBytesColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'bytes' }>;
        },
    ): DrizzleEmitted {
        const sizeOpt =
            meta.type.size !== undefined
                ? `, { length: ${meta.type.size} }`
                : '';
        if (meta.type.fixed) {
            return {
                runtime: binary(name, { length: meta.type.size }),
                source: `binary('${name}'${sizeOpt})`,
                helpers: new Set(['binary']),
            };
        }
        return {
            runtime: varbinary(name, { length: meta.type.size }),
            source: `varbinary('${name}'${sizeOpt})`,
            helpers: new Set(['varbinary']),
        };
    }

    protected createDatetimeColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'datetime' }>;
        },
    ): DrizzleEmitted {
        const fsp = meta.type.fsp ?? 6;
        const mode = requireColumnMode(meta, ['date', 'string']);
        return {
            runtime: datetime(name, { fsp, mode }),
            source: `datetime('${name}', { fsp: ${fsp}, mode: '${mode}' })`,
            helpers: new Set(['datetime']),
        };
    }

    protected createUuidColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'uuid' }>;
        },
    ): DrizzleEmitted {
        const charBuilder = char(name, { length: 36 });
        let source = `char('${name}', { length: 36 })`;
        if (meta.type.generate === true) {
            charBuilder.$default(() => crypto.randomUUID());
            source += '.$default(() => crypto.randomUUID())';
        }
        return {
            runtime: charBuilder,
            source,
            helpers: new Set(['char']),
        };
    }

    protected createJsonColumn(
        name: string,
        _meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'json' }>;
        },
    ): DrizzleEmitted {
        return {
            runtime: json(name),
            source: `json('${name}')`,
            helpers: new Set(['json']),
        };
    }

    protected createEnumColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'enum' }>;
        },
    ): DrizzleEmitted {
        const values = ormEnumStringValues(meta.type.values);
        const valuesSource = values
            .map((v) => `'${String(v).replace(/'/g, "\\'")}'`)
            .join(', ');
        return {
            runtime: mysqlEnum(name, values as [string, ...string[]]),
            source: `mysqlEnum('${name}', [${valuesSource}] as [string, ...string[]])`,
            helpers: new Set(['mysqlEnum']),
        };
    }
}

function floatOptsSource(meta: {
    type: { precision?: number; scale?: number; unsigned?: boolean };
}): string {
    const opts: string[] = [];
    if (meta.type.precision !== undefined) {
        opts.push(`precision: ${meta.type.precision}`);
    }
    if (meta.type.scale !== undefined) {
        opts.push(`scale: ${meta.type.scale}`);
    }
    if (meta.type.unsigned) {
        opts.push(`unsigned: ${meta.type.unsigned}`);
    }
    return opts.length ? `{ ${opts.join(', ')} }` : '';
}
