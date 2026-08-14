// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { registerRule } from '../RegisterRule';

export type UUIDVersion =
    | '1'
    | '3'
    | '4'
    | '5'
    | '6'
    | '7'
    | '8'
    | 'all'
    | 1
    | 3
    | 4
    | 5
    | 6
    | 7
    | 8;

/**
 * The `'all'` pattern matches the 8-4-4-4-12 hex shape without
 * constraining the version or variant nibbles. This is intentional:
 *
 * - The nil UUID (`00000000-0000-0000-0000-000000000000`) is a
 *   well-known sentinel for "no value," widely used as a placeholder
 *   in tests and APIs. RFC 9562 §5.9 defines it explicitly.
 * - The max UUID (`ffffffff-ffff-ffff-ffff-ffffffffffff`) is also
 *   defined by RFC 9562 §5.10.
 * - RFC 9562 adds versions 6, 7, and 8 to the original 1–5 from RFC
 *   4122; a strict `[1-5]` check would reject them.
 *
 * Callers that need a specific version pass the version string and get
 * the strict variant-aware pattern.
 */
const UUID_ANY_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UUID_PATTERNS: Record<string, RegExp> = {
    '1': /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    '3': /^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    '4': /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    '5': /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    '6': /^[0-9a-f]{8}-[0-9a-f]{4}-6[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    '7': /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    '8': /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    all: UUID_ANY_PATTERN,
};

const rule = registerRule<UUIDVersion>({
    name: 'IsUUID',
    check: (value, version) => {
        if (typeof value !== 'string') return false;
        const pattern = UUID_PATTERNS[String(version)];
        return pattern ? pattern.test(value) : false;
    },
    defaultMessage: ({ property, options }) =>
        options === 'all'
            ? `${property} must be a UUID`
            : `${property} must be a UUID v${options}`,
});

/**
 * Validates that the property is a UUID of the given version
 * (`1`–`8`, or `'all'` for any version).
 *
 * @example
 * ```ts
 * @VerifyIsUUID(4)
 * id: string;
 * ```
 */
export const VerifyIsUUID = Object.assign(
    (version: UUIDVersion = 'all') => rule(version),
    {
        check: (value: unknown, version: UUIDVersion = 'all'): boolean =>
            rule.check(value, version),
    },
);
