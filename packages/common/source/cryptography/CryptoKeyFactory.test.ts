// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    deriveKey,
    exportKey,
    importAesKey,
    importEcPrivateKey,
    importEcPublicKey,
    importHmacKey,
    newAesKey,
    newKeyPair,
} from './CryptoKeyFactory';

describe('CryptoKeyFactory', () => {
    describe('newKeyPair', () => {
        it('should create a new ECDH key pair', async () => {
            const keyPair = await newKeyPair();

            expect(keyPair).toBeDefined();
            expect(keyPair.publicKey).toBeDefined();
            expect(keyPair.privateKey).toBeDefined();
            expect(keyPair.publicKey.algorithm.name).toBe('ECDH');
            expect(keyPair.privateKey.algorithm.name).toBe('ECDH');
            expect(keyPair.publicKey.type).toBe('public');
            expect(keyPair.privateKey.type).toBe('private');
        });

        it('should create extractable keys', async () => {
            const keyPair = await newKeyPair();

            expect(keyPair.publicKey.extractable).toBe(true);
            expect(keyPair.privateKey.extractable).toBe(true);
        });

        it('should create keys with correct usages', async () => {
            const keyPair = await newKeyPair();

            expect(keyPair.privateKey.usages).toContain('deriveKey');
        });
    });

    describe('newAesKey', () => {
        it('should create a new AES-GCM key', async () => {
            const key = await newAesKey();

            expect(key).toBeDefined();
            expect(key.algorithm.name).toBe('AES-GCM');
            expect(key.type).toBe('secret');
            expect(key.extractable).toBe(true);
        });

        it('should create key with correct usages', async () => {
            const key = await newAesKey();

            expect(key.usages).toContain('encrypt');
            expect(key.usages).toContain('decrypt');
        });
    });

    describe('deriveKey', () => {
        it('should derive a shared AES key from ECDH key pair', async () => {
            const keyPair1 = await newKeyPair();
            const keyPair2 = await newKeyPair();

            const sharedKey1 = await deriveKey(
                keyPair2.publicKey,
                keyPair1.privateKey,
            );
            const sharedKey2 = await deriveKey(
                keyPair1.publicKey,
                keyPair2.privateKey,
            );

            expect(sharedKey1).toBeDefined();
            expect(sharedKey2).toBeDefined();
            expect(sharedKey1.algorithm.name).toBe('AES-GCM');
            expect(sharedKey2.algorithm.name).toBe('AES-GCM');
            expect(sharedKey1.type).toBe('secret');
            expect(sharedKey2.type).toBe('secret');

            // Both parties should derive the same key
            const exported1 = await exportKey(sharedKey1);
            const exported2 = await exportKey(sharedKey2);
            expect(exported1).toBe(exported2);
        });
    });

    describe('exportKey', () => {
        it('should export public key in SPKI format', async () => {
            const keyPair = await newKeyPair();
            const exported = await exportKey(keyPair.publicKey);

            expect(typeof exported).toBe('string');
            expect(exported.length).toBeGreaterThan(0);
            // Base64 encoded string should be valid
            expect(() => Buffer.from(exported, 'base64')).not.toThrow();
        });

        it('should export private key in PKCS8 format', async () => {
            const keyPair = await newKeyPair();
            const exported = await exportKey(keyPair.privateKey);

            expect(typeof exported).toBe('string');
            expect(exported.length).toBeGreaterThan(0);
            expect(() => Buffer.from(exported, 'base64')).not.toThrow();
        });

        it('should export AES key in raw format', async () => {
            const key = await newAesKey();
            const exported = await exportKey(key);

            expect(typeof exported).toBe('string');
            expect(exported.length).toBeGreaterThan(0);
            expect(() => Buffer.from(exported, 'base64')).not.toThrow();
        });
    });

    describe('importEcPrivateKey', () => {
        it('should import an EC private key from base64', async () => {
            const keyPair = await newKeyPair();
            const exported = await exportKey(keyPair.privateKey);
            const imported = await importEcPrivateKey(exported);

            expect(imported).toBeDefined();
            expect(imported.algorithm.name).toBe('ECDH');
            expect(imported.type).toBe('private');
            expect(imported.usages).toContain('deriveKey');
        });

        it('should create functionally equivalent keys', async () => {
            const originalKeyPair = await newKeyPair();
            const testKeyPair = await newKeyPair();

            const exported = await exportKey(originalKeyPair.privateKey);
            const imported = await importEcPrivateKey(exported);

            // Both keys should derive the same shared key
            const sharedKey1 = await deriveKey(
                testKeyPair.publicKey,
                originalKeyPair.privateKey,
            );
            const sharedKey2 = await deriveKey(testKeyPair.publicKey, imported);

            const exported1 = await exportKey(sharedKey1);
            const exported2 = await exportKey(sharedKey2);
            expect(exported1).toBe(exported2);
        });
    });

    describe('importEcPublicKey', () => {
        it('should import an EC public key from base64', async () => {
            const keyPair = await newKeyPair();
            const exported = await exportKey(keyPair.publicKey);
            const imported = await importEcPublicKey(exported);

            expect(imported).toBeDefined();
            expect(imported.algorithm.name).toBe('ECDH');
            expect(imported.type).toBe('public');
        });

        it('should create functionally equivalent keys', async () => {
            const originalKeyPair = await newKeyPair();
            const testKeyPair = await newKeyPair();

            const exported = await exportKey(originalKeyPair.publicKey);
            const imported = await importEcPublicKey(exported);

            // Both keys should derive the same shared key
            const sharedKey1 = await deriveKey(
                originalKeyPair.publicKey,
                testKeyPair.privateKey,
            );
            const sharedKey2 = await deriveKey(
                imported,
                testKeyPair.privateKey,
            );

            const exported1 = await exportKey(sharedKey1);
            const exported2 = await exportKey(sharedKey2);
            expect(exported1).toBe(exported2);
        });
    });

    describe('importAesKey', () => {
        it('should import an AES key from base64', async () => {
            const originalKey = await newAesKey();
            const exported = await exportKey(originalKey);
            const imported = await importAesKey(exported);

            expect(imported).toBeDefined();
            expect(imported.algorithm.name).toBe('AES-GCM');
            expect(imported.type).toBe('secret');
            expect(imported.usages).toContain('encrypt');
            expect(imported.usages).toContain('decrypt');
        });

        it('should create functionally equivalent keys', async () => {
            const originalKey = await newAesKey();
            const exported = await exportKey(originalKey);
            const imported = await importAesKey(exported);

            const exportedOriginal = await exportKey(originalKey);
            const exportedImported = await exportKey(imported);
            expect(exportedOriginal).toBe(exportedImported);
        });
    });

    describe('importHmacKey', () => {
        it('should import an HMAC key from base64', async () => {
            // Create a sample key material for HMAC
            const keyMaterial = crypto.getRandomValues(new Uint8Array(32));
            const keyBase64 = Buffer.from(keyMaterial).toString('base64');

            const imported = await importHmacKey(keyBase64);

            expect(imported).toBeDefined();
            expect(imported.algorithm.name).toBe('HMAC');
            expect(imported.type).toBe('secret');
            expect(imported.usages).toContain('sign');
            expect(imported.usages).toContain('verify');
        });

        it('should create keys that can sign and verify', async () => {
            const keyMaterial = crypto.getRandomValues(new Uint8Array(32));
            const keyBase64 = Buffer.from(keyMaterial).toString('base64');
            const key = await importHmacKey(keyBase64);

            const testData = new TextEncoder().encode('test message');

            // Should be able to sign
            const signature = await crypto.subtle.sign('HMAC', key, testData);
            expect(signature).toBeDefined();

            // Should be able to verify
            const isValid = await crypto.subtle.verify(
                'HMAC',
                key,
                signature,
                testData,
            );
            expect(isValid).toBe(true);
        });
    });
});
