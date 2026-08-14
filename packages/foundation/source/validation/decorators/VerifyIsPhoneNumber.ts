// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

export type PhoneRegion = 'e164' | 'nanp' | 'international';

export interface IsPhoneNumberOptions {
    /** Which formats to accept. Default: `['e164', 'nanp']`. */
    region?: PhoneRegion | PhoneRegion[];
    /** Allow trailing extensions like `x123`, `ext. 123`, `#123`. Default: `true`. */
    allowExtensions?: boolean;
}

function stripExtension(raw: string, allow: boolean): string {
    if (!allow) return raw;
    return raw.replace(/\s*(?:ext\.?|x|#)\s*\d{1,6}\s*$/i, '');
}

function allSameDigits(digits: string): boolean {
    return /^(\d)\1+$/.test(digits);
}

function isE164Basic(value: string): boolean {
    // + then 8–15 digits, country code cannot start with 0
    return /^\+[1-9]\d{7,14}$/.test(value);
}

function isNanpBasic(raw: string): boolean {
    let digits = raw.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
        digits = digits.slice(1);
    }
    if (digits.length !== 10) return false;
    if (allSameDigits(digits)) return false;
    const area = digits.slice(0, 3);
    const exchange = digits.slice(3, 6);
    return /^[2-9]\d{2}$/.test(area) && /^[2-9]\d{2}$/.test(exchange);
}

function isInternationalLoose(raw: string): boolean {
    const trimmed = raw.trim();
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (allSameDigits(digitsOnly)) return false;
    if (trimmed.startsWith('+')) {
        return isE164Basic(trimmed);
    }
    return digitsOnly.length >= 8 && digitsOnly.length <= 15;
}

function isValidForRegion(
    raw: string,
    region: PhoneRegion,
    allowExt: boolean,
): boolean {
    const s = stripExtension(raw.trim(), allowExt);
    switch (region) {
        case 'e164':
            return isE164Basic(s);
        case 'nanp':
            return isNanpBasic(s);
        case 'international':
            return isInternationalLoose(s);
    }
}

/**
 * Standalone validator — exposed for callers that need to run the
 * phone-number check outside a decorator (e.g. in a service method).
 */
export function verifyIsPhoneNumber(
    value: unknown,
    options?: IsPhoneNumberOptions,
): boolean {
    if (value === null || value === undefined || value === '') return false;
    if (typeof value !== 'string' && typeof value !== 'number') return false;
    const raw = String(value);

    const allowExtensions = options?.allowExtensions ?? true;
    const regions: PhoneRegion[] = Array.isArray(options?.region)
        ? options.region
        : options?.region
          ? [options.region]
          : ['e164', 'nanp'];

    for (const region of regions) {
        if (isValidForRegion(raw, region, allowExtensions)) return true;
    }
    return false;
}

const rule = registerRule<IsPhoneNumberOptions | undefined>({
    name: 'IsPhoneNumber',
    check: (value, options) => verifyIsPhoneNumber(value, options),
    defaultMessage: ({ property, options }) => {
        const regions: PhoneRegion[] = Array.isArray(options?.region)
            ? options.region
            : options?.region
              ? [options.region]
              : ['e164', 'nanp'];
        return `${property} must be a valid ${regions.join(' or ')} phone number`;
    },
});

/**
 * Validates that the property is a phone number in an accepted format
 * (E.164 and North American formats by default).
 *
 * @example
 * ```ts
 * @VerifyIsPhoneNumber()
 * phone: string;
 * ```
 */
export const VerifyIsPhoneNumber = Object.assign(
    (options?: IsPhoneNumberOptions) => rule(options),
    {
        check: (value: unknown, options?: IsPhoneNumberOptions): boolean =>
            rule.check(value, options),
    },
);
