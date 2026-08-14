// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

/**
 * Validates that a number property is not less than the given minimum.
 *
 * @example
 * ```ts
 * @VerifyMin(0)
 * quantity: number;
 * ```
 */
export const VerifyMin = registerRule<number>({
    name: 'Min',
    check: (value, min) => typeof value === 'number' && value >= min,
    defaultMessage: ({ property, options }) =>
        `${property} must not be less than ${options}`,
});
