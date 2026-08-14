// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

/**
 * Validates that the property is an object (not an array and not
 * `null`).
 *
 * @example
 * ```ts
 * @VerifyIsObject()
 * metadata: object;
 * ```
 */
export const VerifyIsObject = registerRule<void>({
    name: 'IsObject',
    check: (value) =>
        typeof value === 'object' && value !== null && !Array.isArray(value),
    defaultMessage: ({ property }) => `${property} must be an object`,
});
