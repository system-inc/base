// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Gets a random element from the array.
 *
 * If the array is empty then it returns undefined.
 *
 * @param array
 * @returns
 */
export function arrayGetRandom<T>(array: ReadonlyArray<T>): T | undefined {
    return getRandom(array, false);
}

/**
 * Gets a random element from the array.
 *
 * If the array is empty then it throws an error.
 *
 * @param array
 * @returns
 */
export function arrayRequireRandom<T>(array: ReadonlyArray<T>): T {
    return getRandom(array);
}

function getRandom<T>(array: ReadonlyArray<T>): T;
function getRandom<T>(array: ReadonlyArray<T>, strict: boolean): T | undefined;
function getRandom<T>(
    array: ReadonlyArray<T>,
    strict: boolean = true,
): T | undefined {
    if (array.length === 0) {
        if (strict) {
            throw new Error(
                'Array cannot be empty when requiring a random element.',
            );
        } else {
            return; // Return undefined if strict is false
        }
    }
    if (array.length === 1) {
        return array[0];
    }
    const randomIndex = Math.floor(Math.random() * array.length);
    return array[randomIndex];
}
