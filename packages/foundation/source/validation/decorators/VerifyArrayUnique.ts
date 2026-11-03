// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { JsonSchema } from '../../serialization/JsonSchema';
import { registerRule } from '../RegisterRule';

const PRIMITIVE_TYPES = new Set(['string', 'number', 'integer', 'boolean']);

/**
 * Whether the array's items are declared primitives (or an enum of them),
 * where identity and deep equality agree.
 */
function hasPrimitiveItems(target: JsonSchema): boolean {
    const items = target.items;
    if (!items) return false;
    if (items.enum) {
        return items.enum.every((value) => typeof value !== 'object');
    }
    return typeof items.type === 'string' && PRIMITIVE_TYPES.has(items.type);
}

/**
 * Validates that an array property contains only unique values.
 *
 * @example
 * ```ts
 * @VerifyArrayUnique()
 * tags: string[];
 * ```
 */
export const VerifyArrayUnique = registerRule<void>({
    name: 'ArrayUnique',
    operatesOn: 'array',
    check: (value) =>
        Array.isArray(value) && new Set(value).size === value.length,
    // The check compares items by identity (a Set) and `uniqueItems`
    // compares them deeply, so two equal objects pass the rule but would
    // fail the keyword: only primitive items get `uniqueItems`.
    jsonSchema: (_options, target) =>
        hasPrimitiveItems(target)
            ? { type: 'array', uniqueItems: true }
            : { type: 'array' },
    defaultMessage: ({ property }) =>
        `${property} must contain only unique values`,
});
