// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { EncryptionKey, ExportedEncryptionKey } from './EncryptionKey';

/**
 * Provides encryption keys for the server.
 *
 * Materialises {@link ExportedEncryptionKey} entries into
 * {@link EncryptionKey} instances on first use and then drops the
 * exported references, so the raw (base64) key material does not live
 * in memory any longer than it takes to import into Web Crypto.
 */
export class EncryptionKeyProvider {
    /**
     * Exported keys pending import. Cleared after the first call to
     * {@link getEncryptionKeys}; retained until then so providers that
     * are constructed during worker bootstrap (before `crypto.subtle`
     * is exercised) don't do unnecessary work.
     */
    private exportedKeys: ExportedEncryptionKey[] | null;

    /**
     * The actual initialized encryption keys after being imported from the exported keys.
     */
    private encryptionKeys: EncryptionKey[] | undefined;

    constructor(exportedKeys: ExportedEncryptionKey[]) {
        if (!exportedKeys || exportedKeys.length === 0) {
            throw new Error(
                'No encryption keys found in environment variables',
            );
        }
        this.exportedKeys = exportedKeys;
    }

    /**
     * Returns the preferred encryption key.
     * Encryption keys can be cycled for various reasons,
     * this function always returns the current preferred key.
     *
     * @returns EncryptionKey
     */
    getPreferredEncryptionKey(): EncryptionKey {
        const encryptionKeys = this.getEncryptionKeys();
        if (encryptionKeys.length === 0) {
            throw new Error('No encryption keys');
        }
        return encryptionKeys[0];
    }

    /**
     * Get an encryption key by its id.
     *
     * @param id
     * @returns
     */
    getEncryptionKey(id: string): EncryptionKey {
        const encryptionKeys = this.getEncryptionKeys();
        const encryptionKey = encryptionKeys.find((key) => key.id == id);
        if (!encryptionKey) {
            throw new Error('Invalid key: ' + id);
        }
        return encryptionKey;
    }

    private getEncryptionKeys(): EncryptionKey[] {
        if (!this.encryptionKeys) {
            if (!this.exportedKeys) {
                throw new Error('Encryption keys already cleared');
            }
            this.encryptionKeys = this.exportedKeys.map(
                (options) => new EncryptionKey(options),
            );
            // Drop the raw (base64) references so the secret material
            // does not outlive its import into Web Crypto.
            this.exportedKeys = null;
        }
        return this.encryptionKeys;
    }
}
