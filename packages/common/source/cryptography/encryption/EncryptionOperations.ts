// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { bytesToBase64, utf8ToBytes } from '../../encoding/ByteEncoding';
import { Secret } from '../../secret/Secret';
import { Dictionary } from '../../type/Dictionary';
import { objectToBuffer } from '../internal/CryptoObjectOperations';
import { EncryptedDataType } from './EncryptionTypes';

/**
 * Additional Authenticated Data accepted by the AES-GCM wrappers.
 *
 * A `Secret<string>` may be passed directly — it will be unwrapped at the
 * crypto primitive boundary so callers never have to hand-reveal it.
 */
export type AuthenticatedData = Dictionary<unknown> | string | Secret<string>;

/**
 * Encrypts a buffer and returns the ciphertext as a Uint8Array.
 *
 * @param data
 * @param key
 * @param authenticatedData
 * @returns
 */
export async function encrypt(
    data: BufferSource,
    key: CryptoKey,
    authenticatedData?: AuthenticatedData,
): Promise<ArrayBuffer> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const algorithm: AesGcmParams = {
        name: 'AES-GCM',
        iv: iv,
    };
    // Secret<string> is an object, so check it before the generic
    // `typeof === 'object'` branch below.
    if (authenticatedData instanceof Secret) {
        algorithm.additionalData = utf8ToBytes(authenticatedData.reveal());
    } else if (typeof authenticatedData === 'object') {
        algorithm.additionalData = objectToBuffer(authenticatedData);
    } else if (typeof authenticatedData === 'string') {
        algorithm.additionalData = utf8ToBytes(authenticatedData);
    }
    const cyphertext = await crypto.subtle.encrypt(algorithm, key, data);
    // combine iv and cyphertext
    const buffer = new Uint8Array(iv.byteLength + cyphertext.byteLength);
    buffer.set(iv);
    buffer.set(new Uint8Array(cyphertext), iv.byteLength);
    return buffer.buffer;
}

/**
 * Encrypts a string and returns it the ciphertext as a Uint8Array.
 *
 * @param data
 * @param key
 * @param authenticatedData
 * @param encoding
 * @returns
 */
export async function encryptString(
    data: string,
    key: CryptoKey,
    authenticatedData?: AuthenticatedData,
): Promise<ArrayBuffer> {
    return await encrypt(utf8ToBytes(data), key, authenticatedData);
}

/**
 * Encrypts a buffer or string and returns it as a base64 encoded string.
 *
 * @param data
 * @param key
 * @param authenticatedData
 *
 * @returns
 */
export async function encryptToString(
    data: BufferSource | string,
    key: CryptoKey,
    authenticatedData?: AuthenticatedData,
): Promise<string> {
    let prefix = '';
    let ciphertext: ArrayBuffer;
    if (typeof data === 'string') {
        prefix += EncryptedDataType.String.toString() + ':';
        ciphertext = await encryptString(data, key, authenticatedData);
    } else {
        prefix += EncryptedDataType.Buffer.toString() + ':';
        ciphertext = await encrypt(data, key, authenticatedData);
    }
    return prefix + bytesToBase64(ciphertext);
}
