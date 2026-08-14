// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { OrmColumnType } from '../interfaces/OrmColumnType';
import {
    ormIndexColumnName,
    ormIndexColumnPrefixLength,
} from '../interfaces/OrmIndexColumn';
import type { OrmTableMetadata } from '../metadata/OrmTableMetadata';

/**
 * InnoDB's hard ceiling for a single index key, in bytes, with the DYNAMIC row
 * format MySQL 8 defaults to. Exceeding it is not a warning and not a
 * truncation — the `CREATE INDEX` fails outright with
 * `ERROR 1071: Specified key was too long`.
 */
export const innoDbMaximumIndexKeyBytes = 3072;

/**
 * Bytes per character for `utf8mb4`, the charset every string column in this
 * schema uses. MySQL sizes an index key by the column's DECLARED maximum, not
 * by the data in it, so a `varchar(1024)` reserves 4096 bytes whether or not a
 * single row ever fills it. That is why a table can hold a million short titles
 * and still refuse the index.
 */
const bytesPerCharacter = 4;

export interface OrmIndexKeyLengthFinding {
    tableName: string;
    indexName: string;
    columns: string[];
    estimatedBytes: number;
    /** The subset of columns responsible for most of the weight, widest first. */
    largestColumns: { name: string; bytes: number }[];
    reason: 'TooLong' | 'TextWithoutPrefix';
}

/**
 * The byte width MySQL reserves for one column inside an index key.
 *
 * Returns `undefined` for a TEXT column, which cannot be indexed at all without
 * an explicit prefix length — a different failure from "too wide", reported
 * separately so the message can say the useful thing.
 */
export function ormIndexColumnKeyBytes(
    columnType: OrmColumnType,
): number | undefined {
    switch (columnType.kind) {
        case 'char':
        case 'varchar':
            return columnType.length * bytesPerCharacter;

        // A TEXT column cannot be indexed without an explicit prefix length,
        // so there is no whole-column width to charge — the caller reports it
        // as needing a prefix rather than as being too wide.
        case 'text':
            return undefined;

        // A uuid is stored as a 36-character string.
        case 'uuid':
            return 36 * bytesPerCharacter;

        // An enum is stored as a 2-byte internal index regardless of its labels.
        case 'enum':
            return 2;

        case 'bytes':
            return columnType.size;

        case 'integer':
            switch (columnType.size) {
                case 'int8':
                    return 1;
                case 'int16':
                    return 2;
                case 'int24':
                    return 3;
                // `int32` and an undeclared size are both a 4-byte INT.
                case 'int32':
                case undefined:
                    return 4;
            }
            break;

        case 'bigint':
            return 8;

        case 'boolean':
            return 1;

        case 'float':
            return 4;

        case 'double':
            return 8;

        // Worst case for the DECIMAL packed format: ~4 bytes per 9 digits.
        case 'decimal':
            return Math.ceil((columnType.precision ?? 10) / 9) * 4 + 4;

        case 'datetime':
            return 8;

        // JSON cannot participate in an index without a generated column.
        case 'json':
            return undefined;

        default:
            // An unrecognized kind is charged a conservative 8 bytes rather
            // than 0, so a new column type can never make an index look
            // smaller than it is.
            return 8;
    }
}

/**
 * Checks every index a table declares against InnoDB's key-length ceiling,
 * BEFORE any SQL is generated.
 *
 * This exists because the failure it catches is invisible everywhere else in
 * the pipeline. The entity decorators accept `@OrmTableIndex(['title'])`
 * without consulting `@OrmColumn`'s length, the schema builder emits a valid
 * `index('...').on(...)`, drizzle-kit writes a syntactically perfect
 * `CREATE INDEX`, and the whole thing looks correct on disk. The error surfaces
 * only when MySQL refuses the statement — and `drizzle-kit migrate` reports
 * that refusal by exiting 1 with nothing but a spinner on stdout, against
 * whichever database was unlucky enough to run it first.
 *
 * Worse, the DDL that already succeeded stays applied: MySQL auto-commits each
 * statement, so a migration that dies halfway leaves the database in a state no
 * migration ledger records. We shipped exactly that and it cost a day of
 * archaeology across three databases to reconstruct.
 *
 * Pure arithmetic over metadata, so it runs offline at generate time with no
 * database connection.
 */
export function ormCheckIndexKeyLength(
    tableMetadata: OrmTableMetadata,
): OrmIndexKeyLengthFinding[] {
    const findings: OrmIndexKeyLengthFinding[] = [];

    if (!tableMetadata.indexes || tableMetadata.indexes.length === 0) {
        return findings;
    }

    // Property key -> declared column type, so an index's column list can be
    // priced without re-walking the column metadata for every index.
    const columnTypesByPropertyKey = new Map<string, OrmColumnType>();
    for (const columnMetadata of tableMetadata.columns) {
        columnTypesByPropertyKey.set(
            columnMetadata.propertyKey,
            columnMetadata.type,
        );
    }

    for (const indexMetadata of tableMetadata.indexes) {
        let estimatedBytes = 0;
        const columnBytes: { name: string; bytes: number }[] = [];
        let hasUnindexableText = false;

        for (const indexColumn of indexMetadata.columns) {
            const propertyKey = ormIndexColumnName(indexColumn);
            const prefixLength = ormIndexColumnPrefixLength(indexColumn);
            const columnType = columnTypesByPropertyKey.get(propertyKey);

            // A column the index names but the table does not declare is
            // already an error the builder raises with a better message.
            if (!columnType) {
                continue;
            }

            // A prefix caps the key at its own width regardless of how wide the
            // column is declared — that is the whole point of declaring one, so
            // it is charged instead of the column's full width. A prefix also
            // makes a TEXT column indexable, which it otherwise is not.
            if (prefixLength !== undefined) {
                const bytes = prefixLength * bytesPerCharacter;
                estimatedBytes = estimatedBytes + bytes;
                columnBytes.push({ name: propertyKey, bytes });
                continue;
            }

            const bytes = ormIndexColumnKeyBytes(columnType);
            if (bytes === undefined) {
                hasUnindexableText = true;
                columnBytes.push({ name: propertyKey, bytes: 0 });
                continue;
            }

            estimatedBytes = estimatedBytes + bytes;
            columnBytes.push({ name: propertyKey, bytes });
        }

        const columnNames = indexMetadata.columns.map(ormIndexColumnName);
        const indexName = indexMetadata.name ?? columnNames.join('_');
        const largestColumns = [...columnBytes]
            .sort((a, b) => b.bytes - a.bytes)
            .slice(0, 3);

        if (hasUnindexableText) {
            findings.push({
                tableName: tableMetadata.name,
                indexName,
                columns: columnNames,
                estimatedBytes,
                largestColumns,
                reason: 'TextWithoutPrefix',
            });
            continue;
        }

        if (estimatedBytes > innoDbMaximumIndexKeyBytes) {
            findings.push({
                tableName: tableMetadata.name,
                indexName,
                columns: columnNames,
                estimatedBytes,
                largestColumns,
                reason: 'TooLong',
            });
        }
    }

    return findings;
}

/**
 * Renders findings as an error a human can act on without opening MySQL docs:
 * which index, how far over, which column is carrying the weight, and the
 * character count that would fit.
 */
export function formatIndexKeyLengthFindings(
    findings: OrmIndexKeyLengthFinding[],
): string {
    const lines: string[] = [];

    for (const finding of findings) {
        if (finding.reason === 'TextWithoutPrefix') {
            lines.push(
                `${finding.tableName}.${finding.indexName} indexes a text column without a prefix length: [${finding.columns.join(', ')}]. ` +
                    `MySQL cannot index TEXT/JSON without an explicit prefix.`,
            );
            continue;
        }

        const widest = finding.largestColumns[0];
        const overBy = finding.estimatedBytes - innoDbMaximumIndexKeyBytes;
        const suggestion = widest
            ? ` The widest column is '${widest.name}' at ${widest.bytes} bytes; a prefix of ${Math.floor(
                  (innoDbMaximumIndexKeyBytes -
                      (finding.estimatedBytes - widest.bytes)) /
                      bytesPerCharacter,
              )} characters or fewer would fit.`
            : '';

        lines.push(
            `${finding.tableName}.${finding.indexName} needs ${finding.estimatedBytes} bytes, ` +
                `${overBy} over InnoDB's ${innoDbMaximumIndexKeyBytes}-byte limit: [${finding.columns.join(', ')}].` +
                suggestion,
        );
    }

    return lines.join('\n');
}
