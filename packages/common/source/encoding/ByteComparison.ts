// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Byte-array comparison primitives that don't rely on a `Buffer` global,
 * so they run in every runtime (Cloudflare Workers, Node, browsers) with
 * no `nodejs_compat`. The codec counterparts live next door in
 * `./ByteEncoding`.
 */

/**
 * Lexicographic unsigned comparison of two byte arrays, matching
 * `Buffer.compare`: returns -1 if `a < b`, 0 if equal, 1 if `a > b`.
 * A shorter array that is a prefix of the other sorts first.
 */
export function compareBytes(a: Uint8Array, b: Uint8Array): number {
    const length = Math.min(a.length, b.length);
    for (let index = 0; index < length; index++) {
        if (a[index] !== b[index]) {
            return a[index] < b[index] ? -1 : 1;
        }
    }
    if (a.length === b.length) {
        return 0;
    }
    return a.length < b.length ? -1 : 1;
}
