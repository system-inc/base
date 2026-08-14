// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

/**
 * Shared empty-check predicate. A value is empty when it is:
 * - `null` / `undefined`
 * - an empty string (`''`)
 * - an empty array (`[]`)
 * - an empty plain object (`{}`)
 *
 * Numbers (including `0`), booleans, and class instances are never
 * empty — values that carry meaning beyond "container is populated"
 * don't belong under this rule.
 */
function isEmptyValue(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (
        typeof value === 'object' &&
        Object.getPrototypeOf(value) === Object.prototype
    ) {
        return Object.keys(value as object).length === 0;
    }
    return false;
}

/**
 * Validates that the property is not empty — rejects `null`,
 * `undefined`, `''`, `[]`, and `{}`. Numbers (including `0`),
 * booleans, and class instances are never empty.
 *
 * @example
 * ```ts
 * @VerifyIsNotEmpty()
 * name: string;
 * ```
 */
export const VerifyIsNotEmpty = registerRule<void>({
    name: 'IsNotEmpty',
    // Emptiness is a property of the whole value (a container), never of its
    // elements, so this is an array-level rule: on an array-typed property it
    // must evaluate the array itself. As a value-level rule the engine would
    // iterate it per element, and an empty array — running zero checks — would
    // never be rejected despite [] being empty by this rule's own definition.
    operatesOn: 'array',
    check: (value) => !isEmptyValue(value),
    defaultMessage: ({ property }) => `${property} should not be empty`,
});
