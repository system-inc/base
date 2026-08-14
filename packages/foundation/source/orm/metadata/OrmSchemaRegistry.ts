// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { stringHash } from '@system-inc/base-common/string/Utilities';
import {
    AnyClass,
    Constructor,
} from '@system-inc/base-common/type/Constructor';
import { OrmColumnOptions } from '../interfaces/OrmColumnOptions';
import { OrmColumnType } from '../interfaces/OrmColumnType';
import { OrmDateEventType } from '../interfaces/OrmDateEventType';
import {
    OrmIndexColumn,
    ormIndexColumnName,
} from '../interfaces/OrmIndexColumn';
import { OrmIntegerSizeType } from '../interfaces/OrmIntegerLengthType';
import { OrmJoinColumnOptions } from '../interfaces/OrmJoinColumnOptions';
import { OrmListenerEventType } from '../interfaces/OrmListenerEventType';
import { OrmPrimaryKeyOptions } from '../interfaces/OrmPrimaryKeyOptions';
import { OrmTableIndexOptions } from '../interfaces/OrmTableIndexOptions';
import { OrmTableOptions } from '../interfaces/OrmTableOptions';
import { getPrimaryKeyColumns } from './OrmPrimaryKeyInfo';
import { OrmRelationMetadata } from './OrmRelationMetadata';
import { OrmTableIndexMetadata } from './OrmTableIndexMetadata';
import { OrmTableMetadata } from './OrmTableMetadata';
import { OrmTableUniqueMetadata } from './OrmTableUniqueMetadata';

const REG = new Map<AnyClass, OrmTableMetadata>();

function ensureModel(ctor: AnyClass): OrmTableMetadata {
    let m = REG.get(ctor);
    if (!m) {
        m = {
            name: ctor.name,
            columns: [],
            relations: [],
            indexes: [],
            uniqueConstraints: [],
            listeners: {
                afterDelete: [],
                afterInsert: [],
                afterLoad: [],
                afterUpdate: [],
                beforeDelete: [],
                beforeInsert: [],
                beforeUpdate: [],
            },
            dateColumns: {
                create: [],
                update: [],
            },
            joinColumns: {},
        };
        REG.set(ctor, m);
    }
    return m;
}

export function ormAddTable(
    ctor: Constructor,
    name?: string,
    options?: OrmTableOptions,
): void {
    const m = ensureModel(ctor);
    if (name) {
        m.name = name;
    }
    m.options = options;
}

export function ormAddColumn(
    ctor: Constructor,
    propertyKey: string,
    type: OrmColumnType,
    options?: OrmColumnOptions,
) {
    const m = ensureModel(ctor);
    m.columns.push({
        propertyKey,
        type,
        options,
    });

    // If this column is marked as primary key, set the table's primaryKey
    // field. A second primary key declaration is an error, never a merge:
    // auto-compositing would have to guess column order, and order defines
    // the backing index. (An existing declaration that already covers this
    // column is fine — ormAddPrimaryAutoColumn registers its column that way.)
    if (options?.primaryKey === true) {
        const existing = m.primaryKey;
        if (existing && !getPrimaryKeyColumns(existing).includes(propertyKey)) {
            throw new Error(
                `Entity '${ctor.name}': column '${propertyKey}' is marked primaryKey while '${getPrimaryKeyColumns(existing).join(', ')}' is already the primary key. A table has exactly one primary key — declare a compound key explicitly with @OrmPrimaryKey([...]) on the class (column order defines the index).`,
            );
        }
        if (!existing) {
            m.primaryKey = {
                type: 'single',
                column: propertyKey,
            };
        }
    }
}

/**
 * Adds an index to a table with optional auto-generated name
 * @param ctor The entity class constructor
 * @param name Optional custom name. If not provided, will be auto-generated as ix_<table>_<cols> or ux_<table>_<cols>
 * @param columns The columns to include in the index
 * @param options Additional index options (e.g., unique)
 */
export function ormAddIndex(
    ctor: AnyClass,
    name: string | undefined,
    columns: OrmIndexColumn[],
    options?: OrmTableIndexOptions,
) {
    ensureModel(ctor).indexes.push({
        name,
        columns,
        options,
    });
}

/**
 * Internal function to add index with optional name
 * @internal
 */
function ormAddIndexInternal(
    ctor: AnyClass,
    name: string | undefined,
    columns: OrmIndexColumn[],
    options?: OrmTableIndexOptions,
) {
    // Ensure the model exists and add the index
    ensureModel(ctor).indexes.push({
        name,
        columns,
        options,
    });
}

/**
 * Adds a single column index with auto-generated name if not provided
 * @internal
 */
export function ormAddColumnIndex(
    ctor: AnyClass,
    propertyKey: string,
    customName?: string,
) {
    // Pass the custom name if provided, otherwise undefined (will be generated during merge)
    ormAddIndexInternal(ctor, customName, [propertyKey]);
}

/**
 * Adds a single column unique constraint with auto-generated name if not provided
 * @internal
 */
export function ormAddColumnUnique(
    ctor: AnyClass,
    propertyKey: string,
    customName?: string,
) {
    // Add to unique constraints, not indexes
    ensureModel(ctor).uniqueConstraints.push({
        columns: [propertyKey],
        name: customName, // Will be generated during merge if not provided
    });
}

/**
 * Adds a single column unique index with auto-generated name if not provided
 * This creates a unique index (different from unique constraint)
 * @internal
 */
export function ormAddColumnUniqueIndex(
    ctor: AnyClass,
    propertyKey: string,
    customName?: string,
) {
    // Pass the custom name if provided, otherwise undefined (will be generated during merge)
    ormAddIndexInternal(ctor, customName, [propertyKey], { unique: true });
}

export function ormAddPrimaryKey(
    ctor: AnyClass,
    columns: string[],
    options?: OrmPrimaryKeyOptions,
) {
    const model = ensureModel(ctor);
    if (model.primaryKey) {
        throw new Error(
            `Entity '${ctor.name}': @OrmPrimaryKey(${columns.join(', ')}) conflicts with the primary key already declared on '${getPrimaryKeyColumns(model.primaryKey).join(', ')}'. A table has exactly one primary key — remove the primaryKey column option / @OrmPrimaryAutoColumn and declare the key once with @OrmPrimaryKey.`,
        );
    }
    model.primaryKey = {
        type: 'composite',
        columns,
        name: options?.name,
    };
}

export function ormAddUniqueConstraint(
    ctor: AnyClass,
    columns: string[],
    name?: string,
) {
    ensureModel(ctor).uniqueConstraints.push({
        name,
        columns,
    });
}

export function ormAddPrimaryAutoColumn(
    ctor: Constructor,
    propertyKey: string,
    strategy: 'serial' | 'uuid',
    size?: OrmIntegerSizeType,
) {
    const metadata = ensureModel(ctor);

    if (metadata.primaryKey) {
        throw new Error(
            `Entity '${ctor.name}': @OrmPrimaryAutoColumn on '${propertyKey}' conflicts with the primary key already declared on '${getPrimaryKeyColumns(metadata.primaryKey).join(', ')}'. A table has exactly one primary key.`,
        );
    }

    if (strategy === 'serial') {
        // Set unified primary key info
        metadata.primaryKey = {
            type: 'auto-serial',
            column: propertyKey,
            size: size,
        };

        let columnType: OrmColumnType;
        if (size === 'int64') {
            columnType = {
                kind: 'bigint',
                mode: 'bigint',
                unsigned: true,
                increment: true,
            };
        } else {
            columnType = {
                kind: 'integer',
                size,
                unsigned: true,
                increment: true,
            };
        }
        ormAddColumn(ctor, propertyKey, columnType, {
            primaryKey: true,
        });
    } else if (strategy === 'uuid') {
        // Set unified primary key info
        metadata.primaryKey = {
            type: 'auto-uuid',
            column: propertyKey,
        };

        ormAddColumn(
            ctor,
            propertyKey,
            {
                kind: 'char',
                length: 36,
            },
            {
                primaryKey: true,
            },
        );
    }
}

export function ormAddListener(
    ctor: Constructor,
    event: OrmListenerEventType,
    methodName: string,
) {
    const m = ensureModel(ctor);
    if (!m.listeners[event]) {
        m.listeners[event] = [];
    }
    m.listeners[event].push(methodName);
}

export function ormAddRelation(
    ctor: Constructor,
    relation: OrmRelationMetadata,
) {
    const m = ensureModel(ctor);
    m.relations.push(relation);
}

export function ormAddDateColumn(
    ctor: Constructor,
    event: OrmDateEventType,
    propertyKey: string,
    options?: OrmColumnOptions,
) {
    const m = ensureModel(ctor);
    if (!m.dateColumns[event]) {
        m.dateColumns[event] = [];
    }
    m.dateColumns[event].push(propertyKey);
    ormAddColumn(
        ctor,
        propertyKey,
        {
            kind: 'datetime',
            mode: 'date',
            fsp: 6,
        },
        options,
    );
}

const MERGED_CACHE = new WeakMap<Constructor, OrmTableMetadata>();

export function ormGetTable(ctor: Constructor): OrmTableMetadata | undefined {
    if (MERGED_CACHE.has(ctor)) {
        return MERGED_CACHE.get(ctor);
    }

    const tableMetadata = REG.get(ctor);
    if (!tableMetadata) {
        // An undecorated subclass of a registered entity (e.g. a GraphQL
        // view type extending its entity) resolves to the nearest
        // registered ancestor's table — it is the same table.
        let parent = Object.getPrototypeOf(ctor) as Constructor | null;
        while (typeof parent === 'function' && parent.name) {
            if (REG.has(parent)) {
                const inherited = ormGetTable(parent);
                if (inherited) {
                    MERGED_CACHE.set(ctor, inherited);
                    return inherited;
                }
                break;
            }
            parent = Object.getPrototypeOf(parent) as Constructor | null;
        }
        Logger.warn(LogCategory.Orm, 'No ORM metadata found for %s', ctor.name);
        return undefined;
    }

    if (tableMetadata.indexes.length > 0) {
        // Normalize index names
        tableMetadata.indexes.forEach((index) => {
            if (!index.name) {
                index.name = makeIndexNameWithHash(
                    index.options?.unique ? 'ux' : 'ix',
                    tableMetadata.name,
                    index.columns.map(ormIndexColumnName),
                );
            }
        });
    }

    if (tableMetadata.uniqueConstraints.length > 0) {
        // Normalize unique constraint names
        tableMetadata.uniqueConstraints.forEach((unique) => {
            if (!unique.name) {
                unique.name = makeIndexNameWithHash(
                    'uc',
                    tableMetadata.name,
                    unique.columns,
                );
            }
        });
    }

    let current: Constructor | undefined = ctor;
    while (
        (current = Object.getPrototypeOf(current)) &&
        current !== Object.prototype
    ) {
        const inheritedMetadata = REG.get(current);
        if (inheritedMetadata) {
            if (!tableMetadata.primaryKey && inheritedMetadata.primaryKey) {
                tableMetadata.primaryKey = inheritedMetadata.primaryKey;
            } else if (
                tableMetadata.primaryKey &&
                inheritedMetadata.primaryKey
            ) {
                // A subclass may widen an inherited key into a composite that
                // still contains it (e.g. @OrmPrimaryKey(['id', 'tenantId'])
                // on an OrmBaseEntity subclass); anything else is two
                // competing primary keys.
                const ownColumns = getPrimaryKeyColumns(
                    tableMetadata.primaryKey,
                );
                const inheritedColumns = getPrimaryKeyColumns(
                    inheritedMetadata.primaryKey,
                );
                const widensInherited = inheritedColumns.every((column) =>
                    ownColumns.includes(column),
                );
                if (!widensInherited) {
                    throw new Error(
                        `Entity '${ctor.name}' declares primary key (${ownColumns.join(', ')}) but inherits a conflicting primary key (${inheritedColumns.join(', ')}) from '${current.name}'. A table has exactly one primary key — remove one declaration or extend a base class without one (e.g. OrmTrackingEntity instead of OrmBaseEntity).`,
                    );
                }
            }

            tableMetadata.columns.unshift(...inheritedMetadata.columns);
            tableMetadata.relations.unshift(...inheritedMetadata.relations);

            if (inheritedMetadata.indexes) {
                tableMetadata.indexes.unshift(
                    ...createInheritedTableIndex(
                        tableMetadata.name,
                        inheritedMetadata.indexes,
                    ),
                );
            }

            if (inheritedMetadata.uniqueConstraints) {
                tableMetadata.uniqueConstraints.unshift(
                    ...createInheritedUniqueContraint(
                        tableMetadata.name,
                        inheritedMetadata.uniqueConstraints,
                    ),
                );
            }

            for (const event of Object.keys(
                inheritedMetadata.listeners,
            ) as OrmListenerEventType[]) {
                tableMetadata.listeners[event].unshift(
                    ...inheritedMetadata.listeners[event],
                );
            }

            for (const key of Object.keys(
                inheritedMetadata.dateColumns,
            ) as OrmDateEventType[]) {
                tableMetadata.dateColumns[key].unshift(
                    ...inheritedMetadata.dateColumns[key],
                );
            }

            // Merge joinColumns
            if (inheritedMetadata.joinColumns) {
                tableMetadata.joinColumns = {
                    ...inheritedMetadata.joinColumns,
                    ...tableMetadata.joinColumns,
                };
            }
        }
    }

    Logger.debug(
        LogCategory.Orm,
        'Merged ORM metadata for %s: %o',
        ctor.name,
        tableMetadata,
    );

    MERGED_CACHE.set(ctor, tableMetadata);
    return tableMetadata;
}

export function ormRequireTable(entity: Constructor): OrmTableMetadata {
    const metadata = ormGetTable(entity);
    if (!metadata) {
        throw new Error(`No ORM metadata defined for ${entity.name}`);
    }
    return metadata;
}

export function ormAddJoinColumn(
    ctor: Constructor,
    propertyKey: string,
    options?: OrmJoinColumnOptions,
) {
    const m = ensureModel(ctor);
    m.joinColumns[propertyKey] = options || {};
}

function createInheritedTableIndex(
    tableName: string,
    indexMetadata: Readonly<OrmTableIndexMetadata>[],
): OrmTableIndexMetadata[] {
    const newIndexes: OrmTableIndexMetadata[] = [];
    for (const index of indexMetadata) {
        newIndexes.push({
            columns: index.columns,
            name: makeIndexNameWithHash(
                index.options?.unique ? 'ux' : 'ix',
                tableName,
                index.columns.map(ormIndexColumnName),
            ),
            options: index.options,
        });
    }
    return newIndexes;
}

function createInheritedUniqueContraint(
    tableName: string,
    uniqueMetadata: Readonly<OrmTableUniqueMetadata>[],
): OrmTableUniqueMetadata[] {
    const newUniques: OrmTableUniqueMetadata[] = [];
    for (const unique of uniqueMetadata) {
        newUniques.push({
            columns: unique.columns,
            name: makeIndexNameWithHash('uc', tableName, unique.columns),
        });
    }
    return newUniques;
}

function norm(s: string): string {
    return (
        s.normalize?.('NFKC') ??
        s // normalize if available
            .toLowerCase()
            .replace(/[^a-z0-9_]+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '')
    );
}

const MAX_MYSQL_INDEX_LEN = 64;

function makeIndexNameWithHash(
    prefix: 'ix' | 'ux' | 'uc',
    tableName: string,
    columns: string[],
    maxLen = MAX_MYSQL_INDEX_LEN,
): string {
    const base = `${prefix}_${norm(tableName.toLowerCase())}_${columns.map(norm).join('_').toLowerCase()}`;
    if (base.length <= maxLen) {
        return base;
    }
    const hash36 = (stringHash(base) >>> 0).toString(36); // unsigned, compact
    const budget = Math.max(1, maxLen - hash36.length - 1); // keep room for "_"
    const trimmed = base.slice(0, budget).replace(/_+$/g, '');
    return `${trimmed}_${hash36}`;
}
