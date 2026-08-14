// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

/**
 * Validates that the property is a string.
 *
 * @example
 * ```ts
 * @VerifyIsString()
 * name: string;
 * ```
 */
export const VerifyIsString = registerRule<void>({
    name: 'IsString',
    check: (value) => typeof value === 'string',
    defaultMessage: ({ property }) => `${property} must be a string`,
});
