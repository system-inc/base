// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Returns a new array with all null and undefined values removed.
 *
 * @param array
 * @returns
 */
export function arrayCompact<T>(
    array: ReadonlyArray<T | null | undefined>,
): T[] {
    return array.filter(
        (item): item is T => item !== null && item !== undefined,
    );
}
