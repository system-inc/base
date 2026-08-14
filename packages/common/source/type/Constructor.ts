// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * A type representing a constructor function that can be used to create instances of a class.
 */
export type Constructor<T = object, A extends unknown[] = any[]> = new (
    ...args: A
) => T;

export type AbstractConstructor<
    T = object,
    A extends unknown[] = any[],
> = abstract new (...args: A) => T;

export type AnyClass<T = object, A extends unknown[] = any[]> =
    | Constructor<T, A>
    | AbstractConstructor<T, A>;

/**
 * Determines if a value is a constructor function.
 *
 * @param value
 * @returns
 */
export function isConstructor(value: unknown): value is Constructor {
    return (
        typeof value === 'function' &&
        typeof value.prototype === 'object' &&
        typeof value.prototype.constructor === 'function'
    );
}

/**
 * A type that can be used to define a nested constructor.
 * This is useful for defining types that can be nested, such as arrays of constructors.
 */
export type NestedConstructor<T = object> =
    | Constructor<T>
    | NestedConstructor<T>[]; // recursion!
