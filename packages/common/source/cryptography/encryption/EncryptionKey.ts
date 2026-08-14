// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { base64ToBytes } from '../../encoding/ByteEncoding';
import { Secret } from '../../secret/Secret';

/**
 * Interface for an encryption key that has been exported.
 * Should be used to import the key into the worker.
 *
 * The `key` field holds raw base64-encoded AES/HMAC material and is
 * wrapped in {@link Secret} so it can't leak through logs or JSON
 * serialization of the containing object. The raw bytes are revealed
 * exactly once, inside the {@link EncryptionKey} constructor, when
 * importing into Web Crypto.
 */
export interface ExportedEncryptionKey {
    id: string;
    key: Secret<string>;
    settings: EncryptionKeySettings;
}

/**
 * Settings for an encryption key.
 */
export interface EncryptionKeySettings {
    encrypt: EncryptionAesKeySettings;
    sign: EncryptionHmacKeySettings;
}

/**
 * Settings for an AES encryption key.
 */
export interface EncryptionAesKeySettings {
    name: string;
    length: number;
}

/**
 * Settings for an HMAC key.
 */
export interface EncryptionHmacKeySettings {
    name: string;
    hash: {
        name: string;
    };
}

/**
 * An encryption key that has been imported into the worker.
 *
 * The imported {@link CryptoKey}s are non-extractable: even a caller
 * that holds this object cannot call `crypto.subtle.exportKey` to pull
 * the raw bytes back out. The raw base64 material is revealed once
 * during construction and then discarded — only the opaque Web Crypto
 * handles remain.
 */
export class EncryptionKey {
    readonly id: string;
    readonly aesKey: Promise<CryptoKey>;
    readonly hmacKey: Promise<CryptoKey>;
    readonly settings: EncryptionKeySettings;

    constructor(options: ExportedEncryptionKey) {
        this.id = options.id;
        this.settings = options.settings;

        const keyBuffer = base64ToBytes(options.key.reveal());
        this.aesKey = crypto.subtle.importKey(
            'raw',
            keyBuffer,
            options.settings.encrypt,
            false,
            ['encrypt', 'decrypt'],
        );

        this.hmacKey = crypto.subtle.importKey(
            'raw',
            keyBuffer,
            options.settings.sign,
            false,
            ['sign', 'verify'],
        );
    }
}
