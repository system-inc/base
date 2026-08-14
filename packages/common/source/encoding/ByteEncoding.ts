// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Web-standard byte/string codecs built on `atob`/`btoa`, available in
 * every runtime (Cloudflare Workers, Node, browsers) with no `Buffer`
 * global and no `nodejs_compat`. base64 uses the standard alphabet (with
 * padding), not base64url.
 *
 * These exist because base-common must stay runtime-agnostic: the crypto
 * helpers previously leaned on a global `Buffer`, which only happened to
 * be present because a bundled dependency polyfilled it. `crypto.subtle`
 * accepts a `Uint8Array` directly, so a `Buffer` was never required.
 */

function toUint8Array(input: ArrayBuffer | ArrayBufferView): Uint8Array {
    if (input instanceof Uint8Array) {
        return input;
    }
    if (ArrayBuffer.isView(input)) {
        return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    }
    return new Uint8Array(input);
}

/**
 * Decodes a standard base64 string into raw bytes.
 *
 * Stricter than the old `Buffer.from(value, 'base64')`: the input must be
 * standard, well-formed base64 (it does not accept base64url or stray
 * whitespace).
 */
export function utf8ToBytes(text: string): Uint8Array<ArrayBuffer> {
    // TextEncoder always allocates a fresh (non-shared) ArrayBuffer, so the
    // cast safely narrows the over-broad ArrayBufferLike lib type to the
    // Uint8Array<ArrayBuffer> that Web Crypto's BufferSource expects.
    return new TextEncoder().encode(text) as Uint8Array<ArrayBuffer>;
}

export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
}

/** Encodes raw bytes into a standard base64 string. */
export function bytesToBase64(input: ArrayBuffer | ArrayBufferView): string {
    const bytes = toUint8Array(input);
    let binary = '';
    for (let index = 0; index < bytes.length; index++) {
        binary += String.fromCharCode(bytes[index]);
    }
    return btoa(binary);
}

/** Encodes raw bytes into a lowercase hex string. */
export function bytesToHex(input: ArrayBuffer | ArrayBufferView): string {
    const bytes = toUint8Array(input);
    let hex = '';
    for (let index = 0; index < bytes.length; index++) {
        hex += bytes[index].toString(16).padStart(2, '0');
    }
    return hex;
}

/**
 * Decodes a lowercase/uppercase hex string into raw bytes — the inverse
 * of {@link bytesToHex}.
 *
 * Stricter than the old `Buffer.from(value, 'hex')`, which silently
 * stops at the first invalid character: this throws on an odd length or
 * any non-hex character. (Note `parseInt` alone is not enough here —
 * `parseInt('1g', 16)` returns `1` rather than `NaN`, so the input is
 * validated up front.)
 */
export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
    if (hex.length % 2 !== 0) {
        throw new Error(`Invalid hex string length: ${hex.length}`);
    }
    if (!/^[0-9a-fA-F]*$/.test(hex)) {
        throw new Error(`Invalid hex string: ${hex}`);
    }
    const bytes = new Uint8Array(hex.length / 2);
    for (let index = 0; index < bytes.length; index++) {
        bytes[index] = parseInt(hex.substring(index * 2, index * 2 + 2), 16);
    }
    return bytes;
}
