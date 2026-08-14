// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { decryptString } from './DecryptionOperations';
import { EncryptionKeyProvider } from './EncryptionKeyProvider';
import { AuthenticatedData } from './EncryptionOperations';
import {
    EncryptedDictionary,
    PlainTextDictionary,
    PlainTextObject,
} from './EncryptionTypes';

/**
 * Decrypts a dictionary of encrypted values.
 *
 * @param input
 * @param encryptionKey
 * @param authenticatedData
 * @returns
 */
export async function decryptDictionary<T extends EncryptedDictionary>(
    input: T,
    encryptionKey: CryptoKey | EncryptionKeyProvider,
    authenticatedData?: AuthenticatedData,
): Promise<PlainTextObject<T>> {
    const out: PlainTextDictionary = {};
    for (const key of Object.keys(input)) {
        const toEncrypt = input[key];
        if (Array.isArray(toEncrypt)) {
            out[key] = await decryptArray(
                toEncrypt,
                encryptionKey,
                authenticatedData,
            );
        } else {
            out[key] = await decryptData(
                toEncrypt,
                encryptionKey,
                authenticatedData,
            );
        }
    }
    // we have to cast to any because the type system doesn't understand
    // that we have added each key from the input to the output so it will match T
    return out as PlainTextObject<T>;
}

/**
 * Decrypts an array of encrypted values.
 *
 * @param data
 * @param encryptionKey
 * @param authenticatedData
 * @returns
 */
export async function decryptArray(
    data: Array<string>,
    encryptionKey: CryptoKey | EncryptionKeyProvider,
    authenticatedData?: AuthenticatedData,
): Promise<Array<string | ArrayBuffer>> {
    const outArray: Array<string | ArrayBuffer> = [];
    for (const item of data) {
        outArray.push(
            await decryptData(item, encryptionKey, authenticatedData),
        );
    }
    return outArray;
}

/**
 * Decrypts an encrypted string value.
 *
 * @param data
 * @param encryptionKey
 * @param authenticatedData
 * @returns
 */
export async function decryptData(
    data: string,
    encryptionKey: CryptoKey | EncryptionKeyProvider,
    authenticatedData?: AuthenticatedData,
): Promise<string | ArrayBuffer> {
    if (typeof data !== 'string') {
        throw new Error('Unsupported type: ' + typeof data);
    }

    let dataToDecrypt = '';
    let key: CryptoKey;

    if (encryptionKey instanceof EncryptionKeyProvider) {
        const parts = data.split(':');
        if (parts.length != 3) {
            throw new Error('Invalid data');
        }
        const keyId = parts[0];
        // this will throw if the key is not found
        const storageKey = encryptionKey.getEncryptionKey(keyId);
        key = await storageKey.aesKey;
        // reassemble the data
        dataToDecrypt = parts[1] + ':' + parts[2];
    } else {
        dataToDecrypt = data;
        key = encryptionKey;
    }

    return await decryptString(dataToDecrypt, key, authenticatedData);
}
