// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { newAesKey } from '../CryptoKeyFactory';
import { decryptString } from './DecryptionOperations';
import {
    encrypt,
    encryptString,
    encryptToString,
} from './EncryptionOperations';
import { EncryptedDataType } from './EncryptionTypes';

describe('EncryptionOperations', () => {
    let testKey: CryptoKey;

    beforeEach(async () => {
        testKey = await newAesKey();
    });

    describe('encrypt', () => {
        it('should encrypt buffer data', async () => {
            const data = new TextEncoder().encode('test message');
            const encrypted = await encrypt(data, testKey);

            expect(encrypted).toBeInstanceOf(ArrayBuffer);
            expect(encrypted.byteLength).toBeGreaterThan(data.byteLength);
            // Should include IV (12 bytes) + data + auth tag
            expect(encrypted.byteLength).toBeGreaterThanOrEqual(
                data.byteLength + 12 + 16,
            );
        });

        it('should encrypt with authenticated data object', async () => {
            const data = new TextEncoder().encode('test message');
            const authData = { user: 'test', role: 'admin' };
            const encrypted = await encrypt(data, testKey, authData);

            expect(encrypted).toBeInstanceOf(ArrayBuffer);
            expect(encrypted.byteLength).toBeGreaterThan(data.byteLength);
        });

        it('should encrypt with authenticated data string', async () => {
            const data = new TextEncoder().encode('test message');
            const authData = 'additional data';
            const encrypted = await encrypt(data, testKey, authData);

            expect(encrypted).toBeInstanceOf(ArrayBuffer);
            expect(encrypted.byteLength).toBeGreaterThan(data.byteLength);
        });

        it('should produce different ciphertexts for same data', async () => {
            const data = new TextEncoder().encode('test message');
            const encrypted1 = await encrypt(data, testKey);
            const encrypted2 = await encrypt(data, testKey);

            expect(Buffer.from(encrypted1).toString('base64')).not.toBe(
                Buffer.from(encrypted2).toString('base64'),
            );
        });
    });

    describe('encryptString', () => {
        it('should encrypt string data', async () => {
            const data = 'test message';
            const encrypted = await encryptString(data, testKey);

            expect(encrypted).toBeInstanceOf(ArrayBuffer);
            expect(encrypted.byteLength).toBeGreaterThan(data.length);
        });
    });

    describe('encryptToString', () => {
        it('should encrypt string and return base64 with type prefix', async () => {
            const data = 'test message';
            const encrypted = await encryptToString(data, testKey);

            expect(typeof encrypted).toBe('string');
            expect(encrypted.startsWith(`${EncryptedDataType.String}:`)).toBe(
                true,
            );

            const parts = encrypted.split(':');
            expect(parts).toHaveLength(2);
            expect(parts[0]).toBe(EncryptedDataType.String.toString());
            expect(() => Buffer.from(parts[1], 'base64')).not.toThrow();
        });

        it('should encrypt buffer and return base64 with type prefix', async () => {
            const data = new TextEncoder().encode('test message');
            const encrypted = await encryptToString(data, testKey);

            expect(typeof encrypted).toBe('string');
            expect(encrypted.startsWith(`${EncryptedDataType.Buffer}:`)).toBe(
                true,
            );

            const parts = encrypted.split(':');
            expect(parts).toHaveLength(2);
            expect(parts[0]).toBe(EncryptedDataType.Buffer.toString());
            expect(() => Buffer.from(parts[1], 'base64')).not.toThrow();
        });

        it('should encrypt with authenticated data', async () => {
            const data = 'test message';
            const authData = { context: 'test' };
            const encrypted = await encryptToString(data, testKey, authData);

            expect(typeof encrypted).toBe('string');
            expect(encrypted.startsWith(`${EncryptedDataType.String}:`)).toBe(
                true,
            );
        });
    });

    describe('roundtrip encryption/decryption', () => {
        it('should decrypt string data correctly', async () => {
            const originalData = 'test message with special chars: éñ中文';
            const encrypted = await encryptToString(originalData, testKey);
            const decrypted = await decryptString(encrypted, testKey);

            expect(decrypted).toBe(originalData);
        });

        it('should decrypt buffer data correctly', async () => {
            const originalData = new TextEncoder().encode('test buffer data');
            const encrypted = await encryptToString(originalData, testKey);
            const decrypted = (await decryptString(
                encrypted,
                testKey,
            )) as ArrayBuffer;
            const decryptedString = new TextDecoder().decode(decrypted);

            expect(decryptedString).toBe('test buffer data');
        });

        it('should decrypt with authenticated data object', async () => {
            const originalData = 'test message';
            const authData = { user: 'test', action: 'read' };
            const encrypted = await encryptToString(
                originalData,
                testKey,
                authData,
            );
            const decrypted = await decryptString(encrypted, testKey, authData);

            expect(decrypted).toBe(originalData);
        });

        it('should decrypt with authenticated data string', async () => {
            const originalData = 'test message';
            const authData = 'context info';
            const encrypted = await encryptToString(
                originalData,
                testKey,
                authData,
            );
            const decrypted = await decryptString(encrypted, testKey, authData);

            expect(decrypted).toBe(originalData);
        });

        it('should fail decryption with wrong authenticated data', async () => {
            const originalData = 'test message';
            const authData = { user: 'test' };
            const wrongAuthData = { user: 'wrong' };
            const encrypted = await encryptToString(
                originalData,
                testKey,
                authData,
            );

            await expect(
                decryptString(encrypted, testKey, wrongAuthData),
            ).rejects.toThrow();
        });

        it('should fail decryption with wrong key', async () => {
            const originalData = 'test message';
            const wrongKey = await newAesKey();
            const encrypted = await encryptToString(originalData, testKey);

            await expect(decryptString(encrypted, wrongKey)).rejects.toThrow();
        });

        it('should handle empty string', async () => {
            const originalData = '';
            const encrypted = await encryptToString(originalData, testKey);
            const decrypted = await decryptString(encrypted, testKey);

            expect(decrypted).toBe(originalData);
        });

        it('should handle large data', async () => {
            const originalData = 'x'.repeat(10000);
            const encrypted = await encryptToString(originalData, testKey);
            const decrypted = await decryptString(encrypted, testKey);

            expect(decrypted).toBe(originalData);
        });
    });
});
