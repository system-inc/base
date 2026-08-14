// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

/**
 * Validates that an array property contains at least the given
 * number of elements.
 *
 * @example
 * ```ts
 * @VerifyArrayMinSize(1)
 * tags: string[];
 * ```
 */
export const VerifyArrayMinSize = registerRule<number>({
    name: 'ArrayMinSize',
    operatesOn: 'array',
    check: (value, min) => Array.isArray(value) && value.length >= min,
    defaultMessage: ({ property, options }) =>
        `${property} must contain at least ${options} elements`,
});
