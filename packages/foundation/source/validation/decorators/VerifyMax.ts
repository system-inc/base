// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

/**
 * Validates that a number property is not greater than the given
 * maximum.
 *
 * @example
 * ```ts
 * @VerifyMax(100)
 * percentage: number;
 * ```
 */
export const VerifyMax = registerRule<number>({
    name: 'Max',
    check: (value, max) => typeof value === 'number' && value <= max,
    jsonSchema: (max) => ({ type: 'number', maximum: max }),
    defaultMessage: ({ property, options }) =>
        `${property} must not be greater than ${options}`,
});
