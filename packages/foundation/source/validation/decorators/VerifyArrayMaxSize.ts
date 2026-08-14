// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

/**
 * Validates that an array property contains no more than the given
 * number of elements.
 *
 * @example
 * ```ts
 * @VerifyArrayMaxSize(10)
 * tags: string[];
 * ```
 */
export const VerifyArrayMaxSize = registerRule<number>({
    name: 'ArrayMaxSize',
    operatesOn: 'array',
    check: (value, max) => Array.isArray(value) && value.length <= max,
    defaultMessage: ({ property, options }) =>
        `${property} must contain no more than ${options} elements`,
});
