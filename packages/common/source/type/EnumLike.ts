// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**  Anything that looks like an enum at runtime. */
export type EnumLike<V = string | number> = Record<string, V>;

/**
 * A type that can be used to define a nested constructor.
 * This is useful for defining types that can be nested, such as arrays of constructors.
 */
export type NestedEnumLike = EnumLike | NestedEnumLike[]; // recursion!

/**
 * Determines if a value is an enum-like type.
 *
 * @param val
 * @returns
 */
export function isEnumLike(val: unknown): val is EnumLike {
    if (typeof val !== 'object' || val === null) {
        return false;
    }
    if ('prototype' in val) {
        return false; // Exclude constructors
    }
    if (Array.isArray(val)) {
        return false; // Exclude arrays
    }

    // Only allow plain objects or objects with null prototype
    const proto = Object.getPrototypeOf(val);
    return proto === Object.prototype || proto === null;
}
