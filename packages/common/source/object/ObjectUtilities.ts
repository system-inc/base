// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Recursively merges `updates` into `original`, returning a new object.
 * Nested plain objects are merged; all other values (arrays, primitives, null)
 * are replaced outright.
 *
 * Usage:
 *   mergeDeep({ a: { b: 1, c: 2 } }, { a: { b: 3 } }) // { a: { b: 3, c: 2 } }
 */
export function mergeDeep<T extends Record<string, unknown>>(
    original: T,
    updates: Partial<T> | Record<string, unknown>,
): T {
    const result = { ...original } as T;
    for (const key in updates) {
        // Only recurse when BOTH sides are plain (non-null, non-array)
        // objects. Otherwise replace outright — including an explicit null
        // update (which must overwrite, not be discarded) and array updates
        // (which replace, not merge by index).
        if (
            isMergeableObject(updates[key]) &&
            isMergeableObject(original[key])
        ) {
            Reflect.set(
                result,
                key,
                mergeDeep(
                    original[key] as Record<string, unknown>,
                    updates[key] as Record<string, unknown>,
                ),
            );
        } else {
            Reflect.set(result, key, updates[key]);
        }
    }
    return result;
}

function isMergeableObject(value: unknown): boolean {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
