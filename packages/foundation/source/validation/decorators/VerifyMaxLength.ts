// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';
import { lengthJsonSchema } from './internal/LengthJsonSchema';

/**
 * Validates that a string or array property is at most the given
 * length.
 *
 * @example
 * ```ts
 * @VerifyMaxLength(280)
 * message: string;
 * ```
 */
export const VerifyMaxLength = registerRule<number>({
    name: 'MaxLength',
    check: (value, max) =>
        (typeof value === 'string' || Array.isArray(value)) &&
        value.length <= max,
    jsonSchema: (max, target) => lengthJsonSchema(target, undefined, max),
    defaultMessage: ({ property, options }) =>
        `${property} must be at most ${options} characters long`,
});
