// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from './Constructor';

/**
 * Determins whether a constructor is a system primitive type or not.
 *
 * @param ctor The constructor to check.
 * @returns
 */
export function isPrimitiveType(ctor: Constructor): boolean {
    switch (ctor.name) {
        case 'String':
        case 'Number':
        case 'Boolean':
        case 'BigInt':
        case 'Symbol':
        case 'Date':
            return true;
        default:
            return false;
    }
}

/**
 * Creates a primitive type value from a constructor and a value.
 *
 * @param ctor The constructor of the primitive type.
 * @param value The value to convert to the primitive type.
 * @returns
 */
export function primitiveTypeCreate(
    ctor: Constructor,
    value: unknown,
): unknown {
    switch (ctor.name) {
        case 'String':
            return String(value);
        case 'Number':
            return Number(value);
        case 'Boolean':
            return Boolean(value);
        case 'BigInt': {
            if (
                typeof value !== 'string' &&
                typeof value !== 'number' &&
                typeof value !== 'bigint' &&
                typeof value !== 'boolean'
            ) {
                throw new TypeError(
                    `BigInt value must be a string or number, got ${typeof value}`,
                );
            }
            return BigInt(value);
        }
        case 'Symbol': {
            if (typeof value !== 'string' && typeof value !== 'number') {
                throw new TypeError(
                    `Symbol value must be a string or symbol, got ${typeof value}`,
                );
            }
            return Symbol(value);
        }
        case 'Date': {
            if (typeof value !== 'string' && !(value instanceof Date)) {
                throw new TypeError(
                    `Date value must be a string or Date object, got ${typeof value}`,
                );
            }
            return new Date(value);
        }
        default:
            throw new TypeError(`Unsupported primitive type: ${ctor.name}`);
    }
}
