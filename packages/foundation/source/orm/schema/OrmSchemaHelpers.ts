// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmColumnType } from '../interfaces/OrmColumnType';
import { OrmColumnMetadata } from '../metadata/OrmColumnMetadata';

export type OrmColumnMetadataOf<K extends OrmColumnType['kind']> =
    OrmColumnMetadata & { type: Extract<OrmColumnType, { kind: K }> };

export function isColumnKind<K extends OrmColumnType['kind']>(
    meta: OrmColumnMetadata,
    kind: K,
): meta is OrmColumnMetadataOf<K> {
    return meta.type.kind === kind;
}

/**
 * Extracts the string values from an enum column's `values` option.
 * Accepts an explicit value list or an enum object; for the object form
 * only string values are kept, so enums merged with a namespace of
 * helper functions contribute just their actual values.
 */
export function ormEnumStringValues(
    values: Record<string, unknown> | string[],
): string[] {
    if (Array.isArray(values)) {
        return values;
    }
    return Object.values(values).filter(
        (value): value is string => typeof value === 'string',
    );
}
