// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { getMetadataStorage } from '@system-inc/type-graphql/metadata/getMetadataStorage';

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { getAllPaginationInputMetadata } from '@system-inc/base-foundation/graphql/PaginationInputMetadata';
import { ormIndexColumnName } from '@system-inc/base-foundation/orm/interfaces/OrmIndexColumn';
import { ormGetTable } from '@system-inc/base-foundation/orm/metadata/OrmSchemaRegistry';
import {
    getPrimaryKeyPropertyKeys,
    OrmTableMetadata,
} from '@system-inc/base-foundation/orm/metadata/OrmTableMetadata';

export interface PaginationInputIndexWarning {
    inputName: string;
    entityName: string;
    kind: 'filter' | 'order';
    column: string;

    /**
     * `ResolverClass.method`, derived from type-graphql metadata when
     * available.
     */
    resolver?: string;
}

/**
 * Cross-references every `@PaginationInputFor` declaration against its
 * entity's declared indexes. A column exposed for client filtering or
 * ordering is a statement that queries were planned for it — one no
 * index can seek on is surfaced as a warning at check time.
 *
 * A column counts as index-backed when it can use an index for a
 * predicate or sort on it alone: it is the LEFTMOST column of a
 * declared index, unique constraint, or the primary key, or carries a
 * column-level `unique`/`primaryKey` option (both create an index). A
 * column sitting behind a server-pinned scope prefix also counts — see
 * `isReachableBehindAServerScope`. Columns are validated for existence
 * by the decorator itself at class definition, so only index coverage
 * is checked here.
 *
 * The declaration registry is global (module-level, populated by every
 * imported input class), so pass `scopeEntities` — the worker's owned +
 * external entities — to report only declarations bound to entities this
 * worker actually registers; otherwise a multi-worker check repeats every
 * warning once per worker.
 */
export function checkPaginationInputIndexes(
    scopeEntities?: ReadonlySet<Constructor<object>>,
): PaginationInputIndexWarning[] {
    const warnings: PaginationInputIndexWarning[] = [];
    for (const [
        inputClass,
        metadata,
    ] of getAllPaginationInputMetadata().entries()) {
        if (scopeEntities && !scopeEntities.has(metadata.entity)) {
            continue;
        }
        const table = ormGetTable(metadata.entity);
        if (!table) {
            continue;
        }
        const indexBacked = collectIndexBackedColumns(table);
        const declaredColumns = new Set<string>([
            ...(metadata.filterColumns ?? []),
            ...(metadata.orderColumns ?? []),
        ]);

        const resolver = resolverFor(inputClass);
        const collect = (
            columns: ReadonlySet<string> | undefined,
            kind: 'filter' | 'order',
        ) => {
            for (const column of columns ?? []) {
                // Virtual order keys are resolver-translated (not entity
                // columns) — the resolver owns their safety and indexing.
                if (metadata.virtualOrderColumns?.has(column)) {
                    continue;
                }
                if (indexBacked.has(column)) {
                    continue;
                }
                if (
                    isReachableBehindAServerScope(
                        table,
                        column,
                        declaredColumns,
                    )
                ) {
                    continue;
                }
                warnings.push({
                    inputName: inputClass.name,
                    entityName: metadata.entity.name,
                    kind,
                    column,
                    resolver,
                });
            }
        };
        collect(metadata.filterColumns, 'filter');
        collect(metadata.orderColumns, 'order');
    }
    return warnings;
}

/**
 * Whether `column` sits behind a prefix that looks like a SERVER scope — an
 * owner id, a bucket, a status the resolver pins — rather than something the
 * client chose.
 *
 * WHY THIS EXISTS. Leftmost-only is the right rule for an unbounded query, and
 * the wrong one for a scoped list. A resolver that opens with
 * `scopeWhere({ bucket, status, parentKey })` pins every query on those three;
 * an index of `(bucket, status, parentKey, name)` is exactly what MySQL needs
 * to scope AND sort in one seek, and a standalone `(name)` index would never be
 * chosen because the optimizer drives from the scope. Under leftmost-only that
 * correct shape reads as a finding per exposed column, each pushing the reader
 * toward a useless index — and a check that is repeatedly wrong teaches people
 * to ignore it.
 *
 * THE SIGNAL. The prefix columns are not declared in this input's own
 * filter/order lists. A client cannot name them, so it cannot choose not to
 * constrain them — which is what makes the prefix a scope rather than just
 * another filter the caller might omit.
 *
 * Symmetrically, a prefix the client CAN name stays reported: an entity
 * indexing `(productId, rate)` that also exposes `productId` as a filter lets
 * a caller query `rate` with no product constraint — a real scan, still said.
 *
 * THE BLIND SPOT, stated plainly. This infers the scope from metadata; it
 * never reads the resolver. A prefix applied CONDITIONALLY —
 * `if (argument) { scopeWhere(...) }` — looks identical here to an
 * unconditional one, so a caller omitting that argument gets an unscoped query
 * this rule has already excused. The cost when it misfires is a slow query,
 * never a wrong or unauthorized one. If that trade stops being worth it, the
 * fix is not a stricter version of this rule — it is reading resolver bodies,
 * which needs dataflow analysis to tell a pinned value from a client-supplied
 * one.
 */
function isReachableBehindAServerScope(
    table: OrmTableMetadata,
    column: string,
    declaredColumns: ReadonlySet<string>,
): boolean {
    const candidates = [
        ...table.indexes.map((index) => index.columns.map(ormIndexColumnName)),
        ...table.uniqueConstraints.map((unique) => unique.columns),
    ];
    return candidates.some((candidate) => {
        const position = candidate.indexOf(column);
        if (position < 1) {
            // Absent, or already leftmost — leftmost is handled by the caller.
            return false;
        }
        return candidate
            .slice(0, position)
            .every((prefixColumn) => !declaredColumns.has(prefixColumn));
    });
}

/**
 * The resolver that consumes an input class, as `ClassName.methodName`.
 *
 * Derived rather than declared: type-graphql already records, for every
 * argument, the resolver class (`target`), the `methodName`, and a `getType`
 * thunk resolving to the argument's type — so the input-to-resolver link
 * exists in metadata and does not need restating on the decorator, where it
 * could drift.
 *
 * This is the difference between a finding that says WHICH COLUMN and one
 * that says WHERE TO LOOK — each finding has to be traced to its resolver
 * before it can be judged.
 *
 * Best-effort by design: `getType` is a thunk that can throw on a
 * partially-initialized registry, and a lazily-registered resolver may not
 * have decorated yet. A missing link degrades the message, never the finding.
 */
function resolverFor(inputClass: Constructor<object>): string | undefined {
    try {
        const parameters = typeGraphQlParameters();
        for (const parameter of parameters) {
            if (typeof parameter.getType !== 'function') {
                continue;
            }
            let resolvedType: unknown;
            try {
                resolvedType = parameter.getType();
            } catch {
                continue;
            }
            if (resolvedType === inputClass) {
                const targetName = parameter.target?.name;
                return targetName
                    ? `${targetName}.${parameter.methodName}`
                    : parameter.methodName;
            }
        }
    } catch {
        // Metadata unavailable in this context — the finding stands regardless.
    }
    return undefined;
}

interface TypeGraphQlParameterInterface {
    target?: { name?: string };
    methodName: string;
    getType?: () => unknown;
}

function typeGraphQlParameters(): TypeGraphQlParameterInterface[] {
    const storage = getMetadataStorage() as { params?: unknown };
    const parameters = storage.params;
    return Array.isArray(parameters)
        ? (parameters as TypeGraphQlParameterInterface[])
        : [];
}

function collectIndexBackedColumns(table: OrmTableMetadata): Set<string> {
    const indexBacked = new Set<string>();
    const primaryKeys = getPrimaryKeyPropertyKeys(table);
    if (primaryKeys.length > 0) {
        indexBacked.add(primaryKeys[0]!);
    }
    for (const index of table.indexes) {
        if (index.columns.length > 0) {
            // A prefix-indexed leading column still backs pagination —
            // the index serves equality and ordering on the column.
            indexBacked.add(ormIndexColumnName(index.columns[0]!));
        }
    }
    for (const unique of table.uniqueConstraints) {
        if (unique.columns.length > 0) {
            indexBacked.add(unique.columns[0]!);
        }
    }
    for (const column of table.columns) {
        if (column.options?.unique || column.options?.primaryKey) {
            indexBacked.add(column.propertyKey);
        }
    }
    return indexBacked;
}

/**
 * Prints warnings in the check command's `[worker]:` log style.
 *
 * Grouped by INPUT, not by entity: the same entity can be exposed through
 * several inputs with different guarantees — one scoped, one not — and
 * grouping by entity collapses those into a single line that is true of
 * neither. The input is also where the fix is applied.
 *
 * The summary states only what the check KNOWS. It reads entity metadata and
 * input declarations: no resolver body, no join, no query plan. It cannot say
 * a scan will happen — only that a column is exposed with no index able to
 * seek on it alone.
 */
export function printPaginationInputIndexWarnings(
    warnings: PaginationInputIndexWarning[],
    logPrefix: string,
): void {
    if (warnings.length === 0) {
        return;
    }

    const byInput = new Map<
        string,
        { entity: string; resolver?: string; findings: string[] }
    >();
    for (const warning of warnings) {
        const existing = byInput.get(warning.inputName) ?? {
            entity: warning.entityName,
            resolver: warning.resolver,
            findings: [],
        };
        existing.findings.push(`${warning.column} (${warning.kind})`);
        byInput.set(warning.inputName, existing);
    }

    console.warn(
        `${logPrefix}⚠️  ${warnings.length} pagination column(s) across ${byInput.size} ` +
            `input(s) are exposed for filtering or ordering with no index able to seek on ` +
            `them alone. Whether a given query actually scans depends on the resolver, ` +
            `which this check cannot see.`,
    );
    for (const [inputName, entry] of [...byInput.entries()].sort(([a], [b]) =>
        a.localeCompare(b),
    )) {
        const via = entry.resolver ? ` → ${entry.resolver}` : '';
        console.warn(
            `${logPrefix}    ${entry.entity} [${inputName}${via}]: ${entry.findings.join(', ')}`,
        );
    }
}
