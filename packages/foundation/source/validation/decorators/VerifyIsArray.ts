// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

/**
 * Validates that the property is an array.
 *
 * @example
 * ```ts
 * @VerifyIsArray()
 * tags: string[];
 * ```
 */
export const VerifyIsArray = registerRule<void>({
    name: 'IsArray',
    operatesOn: 'array',
    check: (value) => Array.isArray(value),
    defaultMessage: ({ property }) => `${property} must be an array`,
});
