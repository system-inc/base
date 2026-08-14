// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

export const GENERAL_RANDOM_CHARSET =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export const LOWERCASE_RANDOM_CHARSET = 'abcdefghijklmnopqrstuvwxyz0123456789';

export async function generateRandomToken(length: number): Promise<string> {
    return randomStringFromCharset(length, GENERAL_RANDOM_CHARSET);
}

export async function generateRandomIdentifier(
    len: number,
    customizedCharset: string | undefined = undefined,
): Promise<string> {
    return randomStringFromCharset(
        len,
        customizedCharset ?? GENERAL_RANDOM_CHARSET,
    );
}

/**
 * Builds a random string by drawing bytes from a CSPRNG
 * (`crypto.getRandomValues`) rather than `Math.random()`, which is not
 * cryptographically secure and must never back tokens or identifiers.
 *
 * Uses rejection sampling: any byte at or above the largest multiple of
 * the charset length is discarded so every character is equiprobable —
 * a plain `byte % charset.length` would bias toward the earlier
 * characters (modulo bias).
 */
function randomStringFromCharset(length: number, charset: string): string {
    const charsetLength = charset.length;
    if (charsetLength < 1 || charsetLength > 256) {
        throw new RangeError(
            `charset length must be between 1 and 256, got ${charsetLength}`,
        );
    }
    if (length <= 0) {
        return '';
    }
    // Largest multiple of charsetLength representable in a byte; bytes at or
    // above it are rejected to keep the distribution uniform.
    const limit = Math.floor(256 / charsetLength) * charsetLength;
    let result = '';
    while (result.length < length) {
        const bytes = crypto.getRandomValues(
            new Uint8Array(length - result.length),
        );
        for (const byte of bytes) {
            if (byte < limit) {
                result += charset.charAt(byte % charsetLength);
            }
        }
    }
    return result;
}

/**
 * Returns a random integer in the range [min, max).
 * Both min and max should be integers.
 */
export function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min)) + min;
}
