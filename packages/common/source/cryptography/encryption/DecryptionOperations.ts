// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { base64ToBytes, utf8ToBytes } from '../../encoding/ByteEncoding';
import { Secret } from '../../secret/Secret';
import { objectToBuffer } from '../internal/CryptoObjectOperations';
import { AuthenticatedData } from './EncryptionOperations';
import { EncryptedDataType } from './EncryptionTypes';

/**
 * Decrypts a buffer and returns it decrypted as an ArrayBuffer.
 *
 * @param data
 * @param key
 * @param authenticatedData
 * @returns
 */
export async function decrypt(
    data: BufferSource | string,
    key: CryptoKey,
    authenticatedData?: AuthenticatedData,
): Promise<ArrayBuffer> {
    // buffersource to uint8array
    let iv: Uint8Array<ArrayBuffer>;
    let ciphertext: Uint8Array<ArrayBuffer>;

    // if data is a string, convert to buffer
    // all string inputs to the system are base64 encoded
    if (typeof data === 'string') {
        data = base64ToBytes(data);
    }

    // create views into the buffer, this avoids copying the data
    if (ArrayBuffer.isView(data)) {
        iv = new Uint8Array(data.buffer, data.byteOffset, 12);
        ciphertext = new Uint8Array(
            data.buffer,
            data.byteOffset + 12,
            data.byteLength - 12,
        );
    } else {
        iv = new Uint8Array(data, 0, 12);
        ciphertext = new Uint8Array(data, 12);
    }

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
    const plaintext = await crypto.subtle.decrypt(algorithm, key, ciphertext);
    return plaintext;
}

/**
 * Decrypts base64 encoded string data and returns it decrypted as an ArrayBuffer.
 *
 * @param data
 * @param key
 * @param authenticatedData
 * @param encoding
 * @returns
 */
export async function decryptToString(
    data: BufferSource | string,
    key: CryptoKey,
    authenticatedData?: AuthenticatedData,
): Promise<string> {
    const plaintext = await decrypt(
        // all string inputs to the system are base64 encoded
        data,
        key,
        authenticatedData,
    );
    return new TextDecoder().decode(plaintext);
}

/**
 * Decrypts base64 encoded string data and returns it decrypted as an ArrayBuffer.
 *
 * @param data
 * @param key
 * @param authenticatedData
 * @param encoding
 * @returns
 */
export async function decryptString(
    data: string,
    key: CryptoKey,
    authenticatedData?: AuthenticatedData,
): Promise<string | ArrayBuffer> {
    const parts = data.split(':');

    if (parts.length != 2) {
        throw new Error('Invalid data');
    }

    const type: EncryptedDataType = parseInt(parts[0]);
    const cipherText = parts[1];

    if (type == EncryptedDataType.String) {
        return await decryptToString(cipherText, key, authenticatedData);
    } else if (type == EncryptedDataType.Buffer) {
        return await decrypt(cipherText, key, authenticatedData);
    } else {
        throw new Error('Invalid type');
    }
}
