// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

/**
 * Validates that the property is neither `null` nor `undefined`.
 *
 * @example
 * ```ts
 * @VerifyIsDefined()
 * accountId: string;
 * ```
 */
export const VerifyIsDefined = registerRule<void>({
    name: 'IsDefined',
    check: (value) => value !== null && value !== undefined,
    defaultMessage: ({ property }) => `${property} must be defined`,
});
