// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
    blob,
    customType,
    index,
    integer,
    primaryKey,
    real,
    sqliteTable,
    text,
    unique,
    uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import { OrmColumnType } from '../../interfaces/OrmColumnType';
import { OrmColumnMetadata } from '../../metadata/OrmColumnMetadata';
import { ormEnumStringValues } from '../OrmSchemaHelpers';
import {
    DrizzleEmitted,
    OrmSchemaBuilderDrizzle,
    OrmSchemaBuilderDrizzleColumns,
    requireColumnMode,
} from './OrmSchemaBuilderDrizzle';

export class OrmSchemaBuilderDrizzleSQLite extends OrmSchemaBuilderDrizzle {
    protected get dialectImportPath(): string {
        return 'drizzle-orm/sqlite-core';
    }

    protected get tableHelperName(): string {
        return 'sqliteTable';
    }

    protected createDialectTable(
        name: string,
        columns: Record<string, any>,
        constraints?: (table: any) => any[],
    ) {
        return sqliteTable(name, columns, constraints);
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
        _meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'integer' }>;
        },
    ): DrizzleEmitted {
        return {
            runtime: integer(name),
            source: `integer('${name}')`,
            helpers: new Set(['integer']),
        };
    }

    protected createBigIntColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'bigint' }>;
        },
    ): DrizzleEmitted {
        const mode = requireColumnMode(meta, ['number', 'bigint']);
        if (mode === 'number') {
            // Runtime uses our customBigInt (stored as text, parsed to number);
            // for the generated schema, drizzle-kit only needs the SQL type,
            // which is text — emit the simpler equivalent.
            return {
                runtime: customBigInt(name),
                source: `text('${name}')`,
                helpers: new Set(['text']),
            };
        }
        return {
            runtime: blob(name, { mode: 'bigint' }),
            source: `blob('${name}', { mode: 'bigint' })`,
            helpers: new Set(['blob']),
        };
    }

    protected createFloatColumn(
        name: string,
        _meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'float' }>;
        },
    ): DrizzleEmitted {
        return {
            runtime: real(name),
            source: `real('${name}')`,
            helpers: new Set(['real']),
        };
    }

    protected createDoubleColumn(
        name: string,
        _meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'double' }>;
        },
    ): DrizzleEmitted {
        return {
            runtime: real(name),
            source: `real('${name}')`,
            helpers: new Set(['real']),
        };
    }

    protected createDecimalColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'decimal' }>;
        },
    ): DrizzleEmitted {
        const mode = requireColumnMode(meta, ['string', 'number', 'bigint']);
        if (mode === 'string') {
            return {
                runtime: text(name),
                source: `text('${name}')`,
                helpers: new Set(['text']),
            };
        }
        if (mode === 'number') {
            return {
                runtime: real(name),
                source: `real('${name}')`,
                helpers: new Set(['real']),
            };
        }
        return {
            runtime: blob(name, { mode: 'bigint' }),
            source: `blob('${name}', { mode: 'bigint' })`,
            helpers: new Set(['blob']),
        };
    }

    protected createBooleanColumn(
        name: string,
        _meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'boolean' }>;
        },
    ): DrizzleEmitted {
        return {
            runtime: integer(name, { mode: 'boolean' }),
            source: `integer('${name}', { mode: 'boolean' })`,
            helpers: new Set(['integer']),
        };
    }

    protected createCharColumn(
        name: string,
        _meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'char' }>;
        },
    ): DrizzleEmitted {
        return {
            runtime: text(name),
            source: `text('${name}')`,
            helpers: new Set(['text']),
        };
    }

    protected createVarcharColumn(
        name: string,
        _meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'varchar' }>;
        },
    ): DrizzleEmitted {
        return {
            runtime: text(name),
            source: `text('${name}')`,
            helpers: new Set(['text']),
        };
    }

    protected createTextColumn(
        name: string,
        _meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'text' }>;
        },
    ): DrizzleEmitted {
        return {
            runtime: text(name),
            source: `text('${name}')`,
            helpers: new Set(['text']),
        };
    }

    protected createBytesColumn(
        name: string,
        _meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'bytes' }>;
        },
    ): DrizzleEmitted {
        return {
            runtime: blob(name, { mode: 'buffer' }),
            source: `blob('${name}', { mode: 'buffer' })`,
            helpers: new Set(['blob']),
        };
    }

    protected createDatetimeColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'datetime' }>;
        },
    ): DrizzleEmitted {
        const mode = requireColumnMode(meta, ['date', 'string']);
        if (mode === 'string') {
            return {
                runtime: text(name),
                source: `text('${name}')`,
                helpers: new Set(['text']),
            };
        }
        // Both runtime and source use customDateTime to round-trip
        // Date ↔ ISO string. `customDateTime` is injected into the
        // generated file by `getCustomTypeDefinitions()` below, so the
        // schema file stays self-contained (no @system-inc imports).
        return {
            runtime: customDateTime(name, meta),
            source: `customDateTime('${name}')`,
            helpers: new Set(['customDateTime']),
        };
    }

    /**
     * Inject the `customDateTime` definition when used. The sentinel
     * 'customDateTime' helper is swapped for `customType` (the actual
     * drizzle-orm import the definition depends on) so the import line
     * stays correct.
     */
    protected getCustomTypeDefinitions(): string {
        if (!this.usedHelpers.has('customDateTime')) return '';
        this.usedHelpers.delete('customDateTime');
        this.usedHelpers.add('customType');
        return `const customDateTime = customType<{ data: Date; driverData: string }>({
    dataType() {
        return 'text';
    },
    toDriver(value: Date): string {
        return value.toISOString();
    },
    fromDriver(value: string): Date {
        return new Date(value);
    },
});`;
    }

    protected createUuidColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'uuid' }>;
        },
    ): DrizzleEmitted {
        const textBuilder = text(name);
        let source = `text('${name}')`;
        if (meta.type.generate === true) {
            textBuilder.$default(() => crypto.randomUUID());
            source += '.$default(() => crypto.randomUUID())';
        }
        return {
            runtime: textBuilder,
            source,
            helpers: new Set(['text']),
        };
    }

    protected createJsonColumn(
        name: string,
        _meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'json' }>;
        },
    ): DrizzleEmitted {
        return {
            runtime: text(name, { mode: 'json' }),
            source: `text('${name}', { mode: 'json' })`,
            helpers: new Set(['text']),
        };
    }

    protected createEnumColumn(
        name: string,
        meta: OrmColumnMetadata & {
            type: Extract<OrmColumnType, { kind: 'enum' }>;
        },
    ): DrizzleEmitted {
        const values = ormEnumStringValues(meta.type.values);
        // SQLite doesn't have native enum support, store as TEXT
        // The application layer should handle validation
        const valuesSource = values
            .map((v) => `'${String(v).replace(/'/g, "\\'")}'`)
            .join(', ');
        return {
            runtime: text(name, {
                enum: values as [string, ...string[]],
            }),
            source: `text('${name}', { enum: [${valuesSource}] as [string, ...string[]] })`,
            helpers: new Set(['text']),
        };
    }
}

const customBigInt = customType<{ data: number; driverData: string }>({
    dataType() {
        return 'text';
    },
    toDriver(value: number): string {
        return value.toString();
    },
    fromDriver(value: string): number {
        return Number(value);
    },
});

const customDateTime = customType<{ data: Date; driverData: string }>({
    dataType() {
        return 'text';
    },
    toDriver(value: Date): string {
        return value.toISOString();
    },
    fromDriver(value: string): Date {
        return new Date(value);
    },
});
