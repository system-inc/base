// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

// Domain name: two or more dot-separated labels, each 1–63 chars,
// alphanumeric or hyphen (not starting or ending with hyphen). TLD
// must be 2+ alpha characters. Matches the common developer use of
// "domain" (e.g. `example.com`, `api.example.co.uk`) — the stricter
// DNS term for this shape is "fully qualified domain name".
const DOMAIN_PATTERN =
    /^(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;

/**
 * Validates that the property is a domain name such as `example.com`
 * or `api.example.co.uk`.
 *
 * @example
 * ```ts
 * @VerifyIsDomain()
 * domain: string;
 * ```
 */
export const VerifyIsDomain = registerRule<void>({
    name: 'IsDomain',
    check: (value) => typeof value === 'string' && DOMAIN_PATTERN.test(value),
    defaultMessage: ({ property }) => `${property} must be a valid domain name`,
});
