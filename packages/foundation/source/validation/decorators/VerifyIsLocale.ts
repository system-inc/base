// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

/**
 * Validates that a value is a well-formed BCP 47 language tag.
 *
 * Uses the built-in `Intl.Locale` constructor, which parses the full
 * BCP 47 grammar (language, script, region, variants, extensions).
 * Examples that pass: `"en"`, `"en-US"`, `"zh-Hans-CN"`, `"ja-JP-u-ca-japanese"`.
 * Examples that fail: `"not-a-locale"`, `"english"`, `"en_US"` (underscore).
 *
 * This is real validation — the runtime does the parsing, so there's
 * no shipped allowlist to maintain.
 *
 * @example
 * ```ts
 * @VerifyIsLocale()
 * locale: string;
 * ```
 */
export const VerifyIsLocale = registerRule<void>({
    name: 'IsLocale',
    check: (value) => {
        if (typeof value !== 'string' || value.length === 0) return false;
        try {
            new Intl.Locale(value);
            return true;
        } catch {
            return false;
        }
    },
    defaultMessage: ({ property }) =>
        `${property} must be a valid BCP 47 locale tag`,
});
