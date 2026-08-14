// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

const rule = registerRule<Date>({
    name: 'MinDate',
    check: (value, minimum) =>
        value instanceof Date && value.getTime() >= minimum.getTime(),
    defaultMessage: ({ property, options }) =>
        `minimal allowed date for ${property} is ${options.toISOString()}`,
});

/**
 * Validates that a `Date` property is on or after the given minimum.
 *
 * @example
 * ```ts
 * @VerifyMinDate(new Date('2000-01-01'))
 * startsAt: Date;
 * ```
 */
export const VerifyMinDate = Object.assign((minimum: Date) => rule(minimum), {
    check: (value: unknown, minimum: Date): boolean =>
        rule.check(value, minimum),
});
