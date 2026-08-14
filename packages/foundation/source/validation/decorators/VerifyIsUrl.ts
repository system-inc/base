// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

/**
 * Validates that the property is a valid `http:` or `https:` URL.
 *
 * @example
 * ```ts
 * @VerifyIsUrl()
 * website: string;
 * ```
 */
export const VerifyIsUrl = registerRule<void>({
    name: 'IsUrl',
    check: (value) => {
        if (typeof value !== 'string') return false;
        try {
            const url = new URL(value);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    },
    defaultMessage: ({ property }) => `${property} must be a valid URL`,
});
