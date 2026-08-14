// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Secret } from '../../secret/Secret';
import { newAesKey } from '../CryptoKeyFactory';
import { decryptArray, decryptData, decryptDictionary } from './Decryption';
import { encryptArray, encryptData, encryptDictionary } from './Encryption';
import { EncryptionKey, ExportedEncryptionKey } from './EncryptionKey';
import { EncryptionKeyProvider } from './EncryptionKeyProvider';

describe('Encryption', () => {
    let testKey: CryptoKey;
    let encryptionKey: EncryptionKey;
    let keyProvider: EncryptionKeyProvider;

    beforeEach(async () => {
        testKey = await newAesKey();

        // Create an EncryptionKey for testing
        const keyMaterial = crypto.getRandomValues(new Uint8Array(16));
        const exportedKey: ExportedEncryptionKey = {
            id: 'test-key-1',
            key: new Secret(Buffer.from(keyMaterial).toString('base64')),
            settings: {
                encrypt: {
                    name: 'AES-GCM',
                    length: 128,
                },
                sign: {
                    name: 'HMAC',
                    hash: { name: 'SHA-256' },
                },
            },
        };
        encryptionKey = new EncryptionKey(exportedKey);

        // Create a KeyProvider for testing
        keyProvider = new EncryptionKeyProvider([exportedKey]);
    });

    describe('encryptData', () => {
        it('should encrypt string data with CryptoKey', async () => {
            const data = 'test message';
            const encrypted = await encryptData(data, testKey);

            expect(typeof encrypted).toBe('string');
            expect(encrypted.length).toBeGreaterThan(0);
            expect(encrypted.includes(':')).toBe(true);
        });

        it('should encrypt buffer data with CryptoKey', async () => {
            const data = new TextEncoder().encode('test message').buffer;
            const encrypted = await encryptData(data, testKey);

            expect(typeof encrypted).toBe('string');
            expect(encrypted.length).toBeGreaterThan(0);
        });

        it('should encrypt a typed-array view (BufferSource), not just ArrayBuffer', async () => {
            // A Uint8Array is a valid BufferSource per the signature; the
            // guard used to reject anything that wasn't an ArrayBuffer.
            const data = new TextEncoder().encode('test message');
            const encrypted = await encryptData(data, testKey);

            expect(typeof encrypted).toBe('string');
            expect(encrypted.length).toBeGreaterThan(0);
        });

        it('should encrypt with EncryptionKey and include key ID', async () => {
            const data = 'test message';
            const encrypted = await encryptData(data, encryptionKey);

            expect(typeof encrypted).toBe('string');
            expect(encrypted.startsWith('test-key-1:')).toBe(true);
        });

        it('should encrypt with EncryptionKeyProvider and include key ID', async () => {
            const data = 'test message';
            const encrypted = await encryptData(data, keyProvider);

            expect(typeof encrypted).toBe('string');
            expect(encrypted.startsWith('test-key-1:')).toBe(true);
        });

        it('should encrypt with authenticated data', async () => {
            const data = 'test message';
            const authData = { context: 'test' };
            const encrypted = await encryptData(data, testKey, authData);

            expect(typeof encrypted).toBe('string');
            expect(encrypted.length).toBeGreaterThan(0);
        });

        it('should throw error for unsupported data type', async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const data = 123 as any;
            await expect(encryptData(data, testKey)).rejects.toThrow(
                'Unsupported type: number',
            );
        });
    });

    describe('encryptArray', () => {
        it('should encrypt array of strings', async () => {
            const data = ['message1', 'message2', 'message3'];
            const encrypted = await encryptArray(data, testKey);

            expect(Array.isArray(encrypted)).toBe(true);
            expect(encrypted).toHaveLength(3);
            encrypted.forEach((item) => {
                expect(typeof item).toBe('string');
                expect(item.length).toBeGreaterThan(0);
            });
        });

        it('should encrypt array of buffers', async () => {
            const data = [
                new TextEncoder().encode('message1').buffer,
                new TextEncoder().encode('message2').buffer,
            ];
            const encrypted = await encryptArray(data, testKey);

            expect(Array.isArray(encrypted)).toBe(true);
            expect(encrypted).toHaveLength(2);
            encrypted.forEach((item) => {
                expect(typeof item).toBe('string');
                expect(item.length).toBeGreaterThan(0);
            });
        });

        it('should encrypt with EncryptionKey', async () => {
            const data = ['message1', 'message2'];
            const encrypted = await encryptArray(data, encryptionKey);

            expect(Array.isArray(encrypted)).toBe(true);
            expect(encrypted).toHaveLength(2);
            encrypted.forEach((item) => {
                expect(item.startsWith('test-key-1:')).toBe(true);
            });
        });

        it('should handle empty array', async () => {
            const data: string[] = [];
            const encrypted = await encryptArray(data, testKey);

            expect(Array.isArray(encrypted)).toBe(true);
            expect(encrypted).toHaveLength(0);
        });
    });

    describe('encryptDictionary', () => {
        it('should encrypt dictionary with string values', async () => {
            const data = {
                name: 'John Doe',
                email: 'john@example.com',
                role: 'admin',
            };
            const encrypted = await encryptDictionary(data, testKey);

            expect(typeof encrypted).toBe('object');
            expect(Object.keys(encrypted)).toEqual(['name', 'email', 'role']);
            Object.values(encrypted).forEach((value) => {
                expect(typeof value).toBe('string');
                expect(value.length).toBeGreaterThan(0);
            });
        });

        it('should encrypt dictionary with buffer values', async () => {
            const data = {
                data1: new TextEncoder().encode('buffer1').buffer,
                data2: new TextEncoder().encode('buffer2').buffer,
            };
            const encrypted = await encryptDictionary(data, testKey);

            expect(typeof encrypted).toBe('object');
            expect(Object.keys(encrypted)).toEqual(['data1', 'data2']);
            Object.values(encrypted).forEach((value) => {
                expect(typeof value).toBe('string');
                expect(value.length).toBeGreaterThan(0);
            });
        });

        it('should encrypt dictionary with array values', async () => {
            const data = {
                messages: ['msg1', 'msg2'],
                numbers: ['1', '2', '3'],
            };
            const encrypted = await encryptDictionary(data, testKey);

            expect(typeof encrypted).toBe('object');
            expect(Object.keys(encrypted)).toEqual(['messages', 'numbers']);
            expect(Array.isArray(encrypted.messages)).toBe(true);
            expect(Array.isArray(encrypted.numbers)).toBe(true);
            expect(encrypted.messages).toHaveLength(2);
            expect(encrypted.numbers).toHaveLength(3);
        });

        it('should encrypt with EncryptionKey', async () => {
            const data = { message: 'test' };
            const encrypted = await encryptDictionary(data, encryptionKey);

            expect(encrypted.message.startsWith('test-key-1:')).toBe(true);
        });

        it('should handle empty dictionary', async () => {
            const data = {};
            const encrypted = await encryptDictionary(data, testKey);

            expect(typeof encrypted).toBe('object');
            expect(Object.keys(encrypted)).toEqual([]);
        });
    });

    describe('roundtrip encryption/decryption', () => {
        it('should decrypt data encrypted with CryptoKey', async () => {
            const originalData = 'test message';
            const encrypted = await encryptData(originalData, testKey);
            const decrypted = await decryptData(encrypted, testKey);

            expect(decrypted).toBe(originalData);
        });

        it('should decrypt array encrypted with CryptoKey', async () => {
            const originalData = ['msg1', 'msg2', 'msg3'];
            const encrypted = await encryptArray(originalData, testKey);
            const decrypted = await decryptArray(encrypted, testKey);

            expect(decrypted).toEqual(originalData);
        });

        it('should decrypt dictionary encrypted with CryptoKey', async () => {
            const originalData = {
                name: 'John',
                email: 'john@test.com',
                messages: ['hello', 'world'],
            };
            const encrypted = await encryptDictionary(originalData, testKey);
            const decrypted = await decryptDictionary(encrypted, testKey);

            expect(decrypted.name).toBe(originalData.name);
            expect(decrypted.email).toBe(originalData.email);
            expect(decrypted.messages).toEqual(originalData.messages);
        });

        it('should decrypt data encrypted with EncryptionKeyProvider', async () => {
            const originalData = 'test message';
            const encrypted = await encryptData(originalData, keyProvider);
            const decrypted = await decryptData(encrypted, keyProvider);

            expect(decrypted).toBe(originalData);
        });

        it('should decrypt with authenticated data', async () => {
            const originalData = 'test message';
            const authData = { user: 'test', action: 'encrypt' };
            const encrypted = await encryptData(
                originalData,
                testKey,
                authData,
            );
            const decrypted = await decryptData(encrypted, testKey, authData);

            expect(decrypted).toBe(originalData);
        });

        it('should fail decryption with wrong authenticated data', async () => {
            const originalData = 'test message';
            const authData = { user: 'test' };
            const wrongAuthData = { user: 'wrong' };
            const encrypted = await encryptData(
                originalData,
                testKey,
                authData,
            );

            await expect(
                decryptData(encrypted, testKey, wrongAuthData),
            ).rejects.toThrow();
        });
    });
});
