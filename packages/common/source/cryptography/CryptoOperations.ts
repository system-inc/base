// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    base64ToBytes,
    bytesToBase64,
    bytesToHex,
} from '../encoding/ByteEncoding';
import { Dictionary } from '../type/Dictionary';
import { objectToBuffer } from './internal/CryptoObjectOperations';

/**
 * Signs data and returns the signature as a base64 encoded string.
 *
 * @param data
 * @param key
 * @param algorithm
 * @returns
 */
export async function sign(
    data: BufferSource | string,
    key: CryptoKey,
    algorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams,
): Promise<string> {
    if (typeof data == 'string') data = new TextEncoder().encode(data);
    const signature = await crypto.subtle.sign(algorithm, key, data);
    return bytesToBase64(signature);
}

/**
 * Verifies a signature.
 *
 * @param data
 * @param signature
 * @param key
 * @param algorithm
 * @returns
 */
export async function verify(
    data: BufferSource | string,
    signature: string,
    key: CryptoKey,
    algorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams,
): Promise<boolean> {
    if (typeof data == 'string') data = new TextEncoder().encode(data);
    return await crypto.subtle.verify(
        algorithm,
        key,
        base64ToBytes(signature),
        data,
    );
}

/**
 * Hashes data and returns the hash as a base64 or hex encoded string.
 *
 * @param data
 * @param format
 * @returns
 */
export async function hash(
    data: BufferSource | string,
    format: 'base64' | 'hex',
): Promise<string> {
    if (typeof data == 'string') {
        data = new TextEncoder().encode(data);
    }
    const hash = await crypto.subtle.digest(
        {
            name: 'SHA-256',
        },
        data,
    );
    return format === 'hex' ? bytesToHex(hash) : bytesToBase64(hash);
}

/**
 * Hashes an object and returns the hash as a base64 or hex encoded string.
 *
 * @param object
 * @param format
 * @returns
 */
export async function hashObject(
    object: Dictionary<unknown>,
    format: 'base64' | 'hex' = 'base64',
): Promise<string> {
    const buffer = objectToBuffer(object);
    return await hash(buffer, format);
}
