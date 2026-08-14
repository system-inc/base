// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

// Pragmatic email regex — not strictly RFC 5322 compliant, but
// accepts the forms users typically enter and rejects clearly
// malformed input. Callers needing stricter validation can layer
// on VerifyStringMatches with a custom regex, or use VerifyBy for a
// dedicated validator.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates that the property is a plausible email address.
 * Pragmatic rather than strictly RFC 5322 — layer `VerifyStringMatches`
 * or `VerifyBy` for stricter needs.
 *
 * @example
 * ```ts
 * @VerifyIsEmail()
 * email: string;
 * ```
 */
export const VerifyIsEmail = registerRule<void>({
    name: 'IsEmail',
    check: (value) => typeof value === 'string' && EMAIL_PATTERN.test(value),
    defaultMessage: ({ property }) => `${property} must be a valid email`,
});
