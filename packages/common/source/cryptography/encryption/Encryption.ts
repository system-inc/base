// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { EncryptionKey } from './EncryptionKey';
import { EncryptionKeyProvider } from './EncryptionKeyProvider';
import { AuthenticatedData, encryptToString } from './EncryptionOperations';
import {
    EncryptedDictionary,
    EncryptedObject,
    PlainTextDictionary,
} from './EncryptionTypes';

/**
 * Encrypts a dictionary of plain text values.
 *
 * @param input
 * @param encryptionKey
 * @param authenticatedData
 * @returns
 */
export async function encryptDictionary<T extends PlainTextDictionary>(
    input: T,
    encryptionKey: CryptoKey | EncryptionKey | EncryptionKeyProvider,
    authenticatedData?: AuthenticatedData,
): Promise<EncryptedObject<T>> {
    const out: EncryptedDictionary = {};
    for (const key of Object.keys(input)) {
        const toEncrypt = input[key];
        if (Array.isArray(toEncrypt)) {
            out[key] = await encryptArray(
                toEncrypt,
                encryptionKey,
                authenticatedData,
            );
        } else {
            out[key] = await encryptData(
                toEncrypt,
                encryptionKey,
                authenticatedData,
            );
        }
    }
    // we have to cast to any because the type system doesn't understand
    // that we have added each key from the input to the output so it will match T
    return out as EncryptedObject<T>;
}

/**
 * Encrypts an array of plain text values.
 *
 * @param input
 * @param encryptionKey
 * @param authenticatedData
 * @returns
 */
export async function encryptArray(
    input: Array<string | BufferSource>,
    encryptionKey: CryptoKey | EncryptionKey | EncryptionKeyProvider,
    authenticatedData?: AuthenticatedData,
): Promise<Array<string>> {
    const outArray: Array<string> = [];
    for (const item of input) {
        outArray.push(
            await encryptData(item, encryptionKey, authenticatedData),
        );
    }
    return outArray;
}

/**
 * Encrypts a plain text value.
 *
 * @param data
 * @param encryptionKey
 * @param authenticatedData
 * @returns
 */
export async function encryptData(
    data: string | BufferSource,
    encryptionKey: CryptoKey | EncryptionKey | EncryptionKeyProvider,
    authenticatedData?: AuthenticatedData,
): Promise<string> {
    if (
        typeof data !== 'string' &&
        !(data instanceof ArrayBuffer) &&
        !ArrayBuffer.isView(data)
    ) {
        throw new Error('Unsupported type: ' + typeof data);
    }

    let prefix = '';
    let key: CryptoKey;

    if (encryptionKey instanceof EncryptionKeyProvider) {
        const serverKey = encryptionKey.getPreferredEncryptionKey();
        prefix = serverKey.id + ':';
        key = await serverKey.aesKey;
    } else if (encryptionKey instanceof EncryptionKey) {
        prefix = encryptionKey.id + ':';
        key = await encryptionKey.aesKey;
    } else {
        key = encryptionKey;
    }

    const cipherText: string = await encryptToString(
        data,
        key,
        authenticatedData,
    );
    return prefix + cipherText;
}
