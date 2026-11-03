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
    // Whether the field may be omitted is the @SerializableField's
    // call (required unless optional or defaulted), and null is never
    // advertised, so this adds no keyword.
    jsonSchema: () => ({}),
    defaultMessage: ({ property }) => `${property} must be defined`,
});
