// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { base64ToBytes, bytesToBase64 } from '../encoding/ByteEncoding';

/**
 * Creates a new key pair for ECDH.
 *
 * @returns
 */
export async function newKeyPair(): Promise<CryptoKeyPair> {
    return await crypto.subtle.generateKey(
        {
            name: 'ECDH',
            namedCurve: 'P-256',
        },
        true,
        ['deriveKey'],
    );
}

/**
 * Creates a new AES key.
 *
 * @returns
 */
export async function newAesKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
        {
            name: 'AES-GCM',
            length: 128,
        },
        true,
        ['encrypt', 'decrypt'],
    );
}

/**
 * Derives a shared key from a public and private key.
 *
 * @param publicKey
 * @param privateKey
 * @returns
 */
export async function deriveKey(
    publicKey: CryptoKey,
    privateKey: CryptoKey,
): Promise<CryptoKey> {
    return await crypto.subtle.deriveKey(
        {
            name: 'ECDH',
            public: publicKey, // The public key of the other party.
        },
        privateKey, // The private key of one of the parties.
        {
            name: 'AES-GCM', // The algorithm to use for the derived key.
            length: 128, // Key length in bits.
        },
        true, // Whether the key is extractable (i.e., can be exported out of the browser).
        ['encrypt', 'decrypt'], // The key will be used for encryption and decryption.
    );
}

/**
 * Exports a key as a base64 encoded string.
 *
 * @param key
 * @returns
 */
export async function exportKey(key: CryptoKey): Promise<string> {
    const formatMap: { [key: string]: 'spki' | 'pkcs8' | 'raw' } = {
        public: 'spki',
        private: 'pkcs8',
        secret: 'raw',
    };
    const buffer = await crypto.subtle.exportKey(formatMap[key.type], key);
    return bytesToBase64(buffer);
}

/**
 * Imports an elliptic curve private key from a base64 encoded string.
 *
 * @param privateKey
 * @returns
 */
export async function importEcPrivateKey(
    privateKey: string,
): Promise<CryptoKey> {
    const buffer = base64ToBytes(privateKey);
    return await crypto.subtle.importKey(
        'pkcs8',
        buffer,
        {
            name: 'ECDH',
            namedCurve: 'P-256',
        },
        true,
        ['deriveKey'],
    );
}

/**
 * Imports an elliptic curve public key from a base64 encoded string.
 *
 * @param privateKey
 * @returns
 */
export async function importEcPublicKey(
    privateKey: string,
): Promise<CryptoKey> {
    const buffer = base64ToBytes(privateKey);
    return await crypto.subtle.importKey(
        'spki',
        buffer,
        {
            name: 'ECDH',
            namedCurve: 'P-256',
        },
        true,
        [],
    );
}

/**
 * Imports an AES key from a base64 encoded string.
 *
 * @param privateKey
 * @returns
 */
export async function importAesKey(privateKey: string): Promise<CryptoKey> {
    const buffer = base64ToBytes(privateKey);
    return await crypto.subtle.importKey(
        'raw',
        buffer,
        {
            name: 'AES-GCM',
            length: 128,
        },
        true,
        ['encrypt', 'decrypt'],
    );
}

/**
 * Imports an HMAC-SHA-256 key. Accepts either a base64-encoded string
 * (legacy convention) or raw bytes (preferred when the caller already
 * has a buffer in hand — e.g. chained HMAC protocols where each step's
 * output feeds the next).
 *
 * @param privateKey base64 string or raw key bytes
 * @returns
 */
export async function importHmacKey(
    privateKey: string | BufferSource,
): Promise<CryptoKey> {
    const buffer =
        typeof privateKey === 'string' ? base64ToBytes(privateKey) : privateKey;
    return await crypto.subtle.importKey(
        'raw',
        buffer,
        {
            name: 'HMAC',
            hash: { name: 'SHA-256' },
        },
        true,
        ['sign', 'verify'],
    );
}
