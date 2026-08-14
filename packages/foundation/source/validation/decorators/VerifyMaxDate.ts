// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

const rule = registerRule<Date>({
    name: 'MaxDate',
    check: (value, maximum) =>
        value instanceof Date && value.getTime() <= maximum.getTime(),
    defaultMessage: ({ property, options }) =>
        `maximal allowed date for ${property} is ${options.toISOString()}`,
});

/**
 * Validates that a `Date` property is on or before the given maximum.
 *
 * @example
 * ```ts
 * @VerifyMaxDate(new Date('2030-01-01'))
 * expiresAt: Date;
 * ```
 */
export const VerifyMaxDate = Object.assign((maximum: Date) => rule(maximum), {
    check: (value: unknown, maximum: Date): boolean =>
        rule.check(value, maximum),
});
