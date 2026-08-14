// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

const rule = registerRule<{ min: number; max?: number }>({
    name: 'Length',
    check: (value, { min, max }) => {
        if (typeof value !== 'string' && !Array.isArray(value)) return false;
        if (value.length < min) return false;
        if (max !== undefined && value.length > max) return false;
        return true;
    },
    defaultMessage: ({ property, options }) =>
        options.max !== undefined
            ? `${property} must be between ${options.min} and ${options.max} characters long`
            : `${property} must be at least ${options.min} characters long`,
});

/**
 * Validates that a string or array property's length is at least
 * `min` and, when given, at most `max` (inclusive).
 *
 * @example
 * ```ts
 * @VerifyLength(1, 80)
 * title: string;
 * ```
 */
export const VerifyLength = Object.assign(
    (min: number, max?: number) => rule({ min, max }),
    {
        check: (value: unknown, min: number, max?: number): boolean =>
            rule.check(value, { min, max }),
    },
);
