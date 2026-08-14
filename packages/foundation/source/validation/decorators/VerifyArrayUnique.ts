// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

/**
 * Validates that an array property contains only unique values.
 *
 * @example
 * ```ts
 * @VerifyArrayUnique()
 * tags: string[];
 * ```
 */
export const VerifyArrayUnique = registerRule<void>({
    name: 'ArrayUnique',
    operatesOn: 'array',
    check: (value) =>
        Array.isArray(value) && new Set(value).size === value.length,
    defaultMessage: ({ property }) =>
        `${property} must contain only unique values`,
});
