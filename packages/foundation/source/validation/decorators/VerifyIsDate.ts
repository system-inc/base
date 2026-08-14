// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

/**
 * Validates that the property is a valid `Date` instance.
 *
 * @example
 * ```ts
 * @VerifyIsDate()
 * birthday: Date;
 * ```
 */
export const VerifyIsDate = registerRule<void>({
    name: 'IsDate',
    check: (value) => value instanceof Date && !Number.isNaN(value.getTime()),
    defaultMessage: ({ property }) => `${property} must be a Date`,
});
