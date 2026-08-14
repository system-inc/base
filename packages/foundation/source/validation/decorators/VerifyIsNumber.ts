// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

/**
 * Validates that the property is a finite number.
 *
 * @example
 * ```ts
 * @VerifyIsNumber()
 * price: number;
 * ```
 */
export const VerifyIsNumber = registerRule<void>({
    name: 'IsNumber',
    check: (value) => typeof value === 'number' && Number.isFinite(value),
    defaultMessage: ({ property }) => `${property} must be a number`,
});
