// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

/**
 * Shapes accepted by {@link VerifyIsEnum}:
 * - a TypeScript `enum` (compiles to an object)
 * - a `const` object literal mapping names to primitive values
 * - a plain array of primitives
 *
 * Element types are constrained to `string | number` because
 * `Array.prototype.includes` — used under the hood — only handles
 * value equality correctly for primitives. Object arrays would
 * silently fail with reference equality, so they're rejected at
 * compile time.
 */
export type EnumLike = object | readonly (string | number)[];

/**
 * The set of values a caller may legitimately send.
 *
 * For an enum-like object this excludes the reverse mappings TypeScript
 * generates for numeric enums: `enum E { A }` compiles to
 * `{ A: 0, 0: 'A' }`, and a naive `Object.values` would accept the member
 * *name* `'A'` as a valid value alongside `0`. A reverse-mapping entry has a
 * numeric-string key whose value points back at that number, so it is
 * dropped; genuine string/const-object entries (and array elements) are kept.
 */
function allowedValues(allowed: EnumLike): unknown[] {
    if (Array.isArray(allowed)) {
        return [...allowed];
    }
    const record = allowed as Record<string, unknown>;
    return Object.entries(record)
        .filter(
            ([key, value]) =>
                !(typeof value === 'string' && record[value] === Number(key)),
        )
        .map(([, value]) => value);
}

const rule = registerRule<EnumLike>({
    name: 'IsEnum',
    check: (value, allowed) => allowedValues(allowed).includes(value),
    defaultMessage: ({ property, options }) =>
        `${property} must be one of ${allowedValues(options).join(', ')}`,
});

/**
 * Validates that a value is one of a defined enumeration.
 *
 * "Enumeration" here is the general sense — any fixed set of allowed
 * values — not strictly a TypeScript `enum`. Accepts:
 *
 * - A TypeScript `enum`: `@VerifyIsEnum(Status)`
 * - A `const` object: `@VerifyIsEnum({ A: 'a', B: 'b' } as const)`
 * - A plain array: `@VerifyIsEnum(['Contact', 'Article'])`
 *
 * @example
 * ```ts
 * @VerifyIsEnum(OrderStatus)
 * status: OrderStatus;
 * ```
 */
export const VerifyIsEnum = Object.assign(
    (allowed: EnumLike) => rule(allowed),
    {
        check: (value: unknown, allowed: EnumLike): boolean =>
            rule.check(value, allowed),
    },
);
