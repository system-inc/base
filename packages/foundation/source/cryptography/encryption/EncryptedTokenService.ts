// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { decryptData } from '@system-inc/base-common/cryptography/encryption/Decryption';
import { encryptData } from '@system-inc/base-common/cryptography/encryption/Encryption';
import { EncryptionKeyProvider } from '@system-inc/base-common/cryptography/encryption/EncryptionKeyProvider';
import { Inject } from '../../dependency-injection/decorators/Inject';
import { Injectable } from '../../dependency-injection/decorators/Injectable';
import { EncryptionKeyService } from './EncryptionKeyService';

/**
 * Generic service for encrypting and decrypting typed payloads into
 * token strings. Uses AES encryption with key rotation support.
 *
 * Tokens are self-validating — successful decryption proves authenticity.
 */
@Injectable()
export class EncryptedTokenService {
    constructor(
        @Inject(EncryptionKeyService)
        private readonly encryptionKeyService: EncryptionKeyProvider,
    ) {}

    /**
     * Encrypt a payload into a token string.
     */
    async encrypt<T>(payload: T, authenticatedData?: string): Promise<string> {
        return encryptData(
            JSON.stringify(payload),
            this.encryptionKeyService,
            authenticatedData,
        );
    }

    /**
     * Decrypt a token string back into a typed payload.
     * Returns null if the token is invalid or tampered with.
     */
    async decrypt<T>(
        token: string,
        authenticatedData?: string,
    ): Promise<T | null> {
        try {
            const decrypted = await decryptData(
                token,
                this.encryptionKeyService,
                authenticatedData,
            );
            if (typeof decrypted !== 'string') {
                return null;
            }
            return JSON.parse(decrypted) as T;
        } catch {
            return null;
        }
    }

    /**
     * Encrypt a payload and URL-encode the result for use in URLs.
     */
    async encryptForUrl<T>(
        payload: T,
        authenticatedData?: string,
    ): Promise<string> {
        const encrypted = await this.encrypt(payload, authenticatedData);
        return encodeURIComponent(encrypted);
    }

    /**
     * URL-decode and decrypt a token from a URL.
     * Returns null if the token is invalid or tampered with.
     */
    async decryptFromUrl<T>(
        token: string,
        authenticatedData?: string,
    ): Promise<T | null> {
        let decoded: string;
        try {
            decoded = decodeURIComponent(token);
        } catch {
            // Malformed percent-encoding (e.g. a lone '%' or '%ZZ') throws a
            // URIError. Treat it as an invalid token — per the documented
            // contract — rather than letting the URIError reach the caller
            // (a hostile/garbage cookie would otherwise crash the request).
            return null;
        }
        return this.decrypt<T>(decoded, authenticatedData);
    }
}
