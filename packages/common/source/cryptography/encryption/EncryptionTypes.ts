// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Dictionary } from '../../type/Dictionary';

/**
 * A dictionary of decrypted plain text values, as either strings or ArrayBuffers.
 */
export type PlainTextDictionary = Dictionary<
    string | ArrayBuffer | Array<string | ArrayBuffer>
>;

/**
 * A dictionary of encrypted values, as either strings or arrays of strings.
 */
export type EncryptedDictionary = Dictionary<string | Array<string>>;

/**
 * A dictionary with matching keys from the source dictionary
 * of encrypted values, as either strings or arrays of strings.
 */
export type EncryptedObject<T extends PlainTextDictionary> = {
    [K in keyof T]: string;
};

/**
 * A dictionary with matching keys from the source dictionary
 * of decrypted plain text values, as either strings or ArrayBuffers.
 */
export type PlainTextObject<T extends EncryptedDictionary> = {
    [K in keyof T]: string | ArrayBuffer;
};

/**
 * Enum for the type of encrypted data.
 */
export enum EncryptedDataType {
    String = 0,
    Buffer = 1,
}
