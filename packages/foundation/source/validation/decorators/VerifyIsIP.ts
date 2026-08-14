// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

export type IPVersion = '4' | '6' | 4 | 6;

const IPV4_PATTERN =
    /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/;

/**
 * Accepts the common IPv6 forms: full 8-group, `::`-compressed,
 * loopback `::1`, and IPv4-mapped (`::ffff:1.2.3.4`). Not a strict
 * RFC 5952 canonicaliser — aimed at rejecting obvious junk.
 */
const IPV6_PATTERN =
    /^((([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4})|(([0-9a-fA-F]{1,4}:){1,7}:)|(([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4})|(([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2})|(([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3})|(([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4})|(([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5})|([0-9a-fA-F]{1,4}:(:[0-9a-fA-F]{1,4}){1,6})|(:(:[0-9a-fA-F]{1,4}){1,7}|:)|(::(ffff(:0{1,4})?:)?((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)))$/;

const rule = registerRule<IPVersion | undefined>({
    name: 'IsIP',
    check: (value, version) => {
        if (typeof value !== 'string') return false;
        const normalized = version === undefined ? undefined : String(version);
        if (normalized === '4') return IPV4_PATTERN.test(value);
        if (normalized === '6') return IPV6_PATTERN.test(value);
        return IPV4_PATTERN.test(value) || IPV6_PATTERN.test(value);
    },
    defaultMessage: ({ property, options }) =>
        options
            ? `${property} must be a valid IPv${options} address`
            : `${property} must be a valid IP address`,
});

/**
 * Validates that the property is an IPv4 or IPv6 address. Pass a
 * version to accept only one family.
 *
 * @example
 * ```ts
 * @VerifyIsIP(4)
 * address: string;
 * ```
 */
export const VerifyIsIP = Object.assign(
    (version?: IPVersion) => rule(version),
    {
        check: (value: unknown, version?: IPVersion): boolean =>
            rule.check(value, version),
    },
);
