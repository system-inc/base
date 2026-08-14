// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';
import {
    ISO_3166_1_ALPHA2,
    ISO_3166_1_ALPHA3,
    ISO_3166_1_NUMERIC,
} from './internal/Iso3166Codes';

export type CountryCodeFormat = 'alpha2' | 'alpha3' | 'numeric';

const rule = registerRule<CountryCodeFormat>({
    name: 'IsCountryCode',
    check: (value, format) => {
        if (typeof value !== 'string') return false;
        switch (format) {
            case 'alpha2':
                return ISO_3166_1_ALPHA2.has(value);
            case 'alpha3':
                return ISO_3166_1_ALPHA3.has(value);
            case 'numeric':
                return ISO_3166_1_NUMERIC.has(value);
        }
    },
    defaultMessage: ({ property, options }) =>
        `${property} must be a valid ISO 3166-1 ${options} country code`,
});

/**
 * Validates that a value is a real ISO 3166-1 country code. Membership
 * is checked against the complete list (249 entries per format).
 *
 * Formats:
 * - `'alpha2'` (default) — two uppercase letters (`US`, `DE`, `GB`)
 * - `'alpha3'` — three uppercase letters (`USA`, `DEU`, `GBR`)
 * - `'numeric'` — three digits as a string, zero-padded (`840`, `276`, `826`)
 *
 * The ISO list is stable (1–2 updates per decade); the embedded data
 * lives in `./internal/Iso3166Codes.ts` and can be resynced from the
 * ISO Maintenance Agency when needed.
 *
 * @example
 * ```ts
 * @VerifyIsCountryCode('alpha2')
 * country: string;
 * ```
 */
export const VerifyIsCountryCode = Object.assign(
    (format: CountryCodeFormat = 'alpha2') => rule(format),
    {
        check: (
            value: unknown,
            format: CountryCodeFormat = 'alpha2',
        ): boolean => rule.check(value, format),
    },
);
