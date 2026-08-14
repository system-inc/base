// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor, NestedConstructor } from './Constructor';
import { EnumLike, NestedEnumLike } from './EnumLike';

/**
 * A function that returns a type. Use in decorators to avoid cycles.
 * This could be a constructor function or an enum-like type.
 */
export type TypeFunc<T = object> = ConstructorTypeFunc<T> | EnumTypeFunc;

/**
 * A function that returns a constructor type.
 */
export type ConstructorTypeFunc<T> = () => NestedConstructor<T>;

/**
 * A function that returns an enum-like type.
 */
export type EnumTypeFunc = () => NestedEnumLike;

/**
 * Gets the underlying type from a TypeFunc.
 *
 * @param typeFunc
 * @returns
 */
export function typeFuncUnwrap<T extends object>(
    typeFunc: TypeFunc<T>,
): Constructor<T> | EnumLike {
    let current = typeFunc();
    while (Array.isArray(current)) {
        if (current.length === 0 || current.length > 1) {
            throw new Error(
                'TypeFunc array literal must have exactly one element',
            );
        }
        current = current[0];
    }
    return current;
}
