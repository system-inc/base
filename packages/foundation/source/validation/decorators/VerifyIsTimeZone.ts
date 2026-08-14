// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

/**
 * Validates that the property is a valid IANA time zone name such as
 * `America/Denver`.
 *
 * @example
 * ```ts
 * @VerifyIsTimeZone()
 * timeZone: string;
 * ```
 */
export const VerifyIsTimeZone = registerRule<void>({
    name: 'IsTimeZone',
    check: (value) => {
        if (typeof value !== 'string') return false;
        try {
            // ICU throws for unknown zones; passes silently for valid ones.
            new Intl.DateTimeFormat(undefined, { timeZone: value });
            return true;
        } catch {
            return false;
        }
    },
    defaultMessage: ({ property }) =>
        `${property} must be a valid IANA time zone`,
});
