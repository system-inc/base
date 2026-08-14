// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

/**
 * Validates that the property is an integer.
 *
 * @example
 * ```ts
 * @VerifyIsInt()
 * quantity: number;
 * ```
 */
export const VerifyIsInt = registerRule<void>({
    name: 'IsInt',
    check: (value) => Number.isInteger(value),
    defaultMessage: ({ property }) => `${property} must be an integer`,
});
