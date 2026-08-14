// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

/**
 * Validates that the property is a boolean.
 *
 * @example
 * ```ts
 * @VerifyIsBoolean()
 * verified: boolean;
 * ```
 */
export const VerifyIsBoolean = registerRule<void>({
    name: 'IsBoolean',
    check: (value) => typeof value === 'boolean',
    defaultMessage: ({ property }) => `${property} must be a boolean`,
});
