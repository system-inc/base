// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

/**
 * Validates that a string or array property is at least the given
 * length.
 *
 * @example
 * ```ts
 * @VerifyMinLength(8)
 * password: string;
 * ```
 */
export const VerifyMinLength = registerRule<number>({
    name: 'MinLength',
    check: (value, min) =>
        (typeof value === 'string' || Array.isArray(value)) &&
        value.length >= min,
    defaultMessage: ({ property, options }) =>
        `${property} must be at least ${options} characters long`,
});
