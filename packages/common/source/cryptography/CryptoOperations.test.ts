// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { importHmacKey } from './CryptoKeyFactory';
import { hash, hashObject, sign, verify } from './CryptoOperations';

describe('CryptoOperations', () => {
    describe('sign', () => {
        it('should sign string data with HMAC key', async () => {
            const keyMaterial = crypto.getRandomValues(new Uint8Array(32));
            const keyBase64 = Buffer.from(keyMaterial).toString('base64');
            const hmacKey = await importHmacKey(keyBase64);

            const data = 'test message';
            const signature = await sign(data, hmacKey, 'HMAC');

            expect(typeof signature).toBe('string');
            expect(signature.length).toBeGreaterThan(0);
            expect(() => Buffer.from(signature, 'base64')).not.toThrow();
        });

        it('should sign buffer data with HMAC key', async () => {
            const keyMaterial = crypto.getRandomValues(new Uint8Array(32));
            const keyBase64 = Buffer.from(keyMaterial).toString('base64');
            const hmacKey = await importHmacKey(keyBase64);

            const data = new TextEncoder().encode('test message');
            const signature = await sign(data, hmacKey, 'HMAC');

            expect(typeof signature).toBe('string');
            expect(signature.length).toBeGreaterThan(0);
        });

        it('should produce different signatures for different data', async () => {
            const keyMaterial = crypto.getRandomValues(new Uint8Array(32));
            const keyBase64 = Buffer.from(keyMaterial).toString('base64');
            const hmacKey = await importHmacKey(keyBase64);

            const signature1 = await sign('message1', hmacKey, 'HMAC');
            const signature2 = await sign('message2', hmacKey, 'HMAC');

            expect(signature1).not.toBe(signature2);
        });

        it('should produce consistent signatures for same data and key', async () => {
            const keyMaterial = crypto.getRandomValues(new Uint8Array(32));
            const keyBase64 = Buffer.from(keyMaterial).toString('base64');
            const hmacKey = await importHmacKey(keyBase64);

            const data = 'consistent message';
            const signature1 = await sign(data, hmacKey, 'HMAC');
            const signature2 = await sign(data, hmacKey, 'HMAC');

            expect(signature1).toBe(signature2);
        });
    });

    describe('verify', () => {
        it('should verify a valid signature', async () => {
            const keyMaterial = crypto.getRandomValues(new Uint8Array(32));
            const keyBase64 = Buffer.from(keyMaterial).toString('base64');
            const hmacKey = await importHmacKey(keyBase64);

            const data = 'test message';
            const signature = await sign(data, hmacKey, 'HMAC');
            const isValid = await verify(data, signature, hmacKey, 'HMAC');

            expect(isValid).toBe(true);
        });

        it('should reject an invalid signature', async () => {
            const keyMaterial = crypto.getRandomValues(new Uint8Array(32));
            const keyBase64 = Buffer.from(keyMaterial).toString('base64');
            const hmacKey = await importHmacKey(keyBase64);

            const data = 'test message';
            const wrongSignature =
                Buffer.from('invalid signature').toString('base64');
            const isValid = await verify(data, wrongSignature, hmacKey, 'HMAC');

            expect(isValid).toBe(false);
        });

        it('should reject signature for modified data', async () => {
            const keyMaterial = crypto.getRandomValues(new Uint8Array(32));
            const keyBase64 = Buffer.from(keyMaterial).toString('base64');
            const hmacKey = await importHmacKey(keyBase64);

            const originalData = 'original message';
            const modifiedData = 'modified message';
            const signature = await sign(originalData, hmacKey, 'HMAC');
            const isValid = await verify(
                modifiedData,
                signature,
                hmacKey,
                'HMAC',
            );

            expect(isValid).toBe(false);
        });

        it('should work with buffer data', async () => {
            const keyMaterial = crypto.getRandomValues(new Uint8Array(32));
            const keyBase64 = Buffer.from(keyMaterial).toString('base64');
            const hmacKey = await importHmacKey(keyBase64);

            const data = new TextEncoder().encode('test message');
            const signature = await sign(data, hmacKey, 'HMAC');
            const isValid = await verify(data, signature, hmacKey, 'HMAC');

            expect(isValid).toBe(true);
        });
    });

    describe('hash', () => {
        it('should hash string data and return base64', async () => {
            const data = 'test message';
            const hashResult = await hash(data, 'base64');

            expect(typeof hashResult).toBe('string');
            expect(hashResult.length).toBeGreaterThan(0);
            expect(() => Buffer.from(hashResult, 'base64')).not.toThrow();
        });

        it('should hash string data and return hex', async () => {
            const data = 'test message';
            const hashResult = await hash(data, 'hex');

            expect(typeof hashResult).toBe('string');
            expect(hashResult.length).toBeGreaterThan(0);
            expect(/^[0-9a-f]+$/.test(hashResult)).toBe(true);
        });

        it('should hash buffer data', async () => {
            const data = new TextEncoder().encode('test message');
            const hashResult = await hash(data, 'base64');

            expect(typeof hashResult).toBe('string');
            expect(hashResult.length).toBeGreaterThan(0);
        });

        it('should produce consistent hashes for same data', async () => {
            const data = 'consistent message';
            const hash1 = await hash(data, 'base64');
            const hash2 = await hash(data, 'base64');

            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for different data', async () => {
            const hash1 = await hash('message1', 'base64');
            const hash2 = await hash('message2', 'base64');

            expect(hash1).not.toBe(hash2);
        });

        it('should produce different formats for same data', async () => {
            const data = 'test message';
            const base64Hash = await hash(data, 'base64');
            const hexHash = await hash(data, 'hex');

            expect(base64Hash).not.toBe(hexHash);
            expect(typeof base64Hash).toBe('string');
            expect(typeof hexHash).toBe('string');
        });
    });

    describe('hashObject', () => {
        it('should hash an object and return base64', async () => {
            const obj = { name: 'test', value: 42 };
            const hashResult = await hashObject(obj);

            expect(typeof hashResult).toBe('string');
            expect(hashResult.length).toBeGreaterThan(0);
            expect(() => Buffer.from(hashResult, 'base64')).not.toThrow();
        });

        it('should hash an object and return hex', async () => {
            const obj = { name: 'test', value: 42 };
            const hashResult = await hashObject(obj, 'hex');

            expect(typeof hashResult).toBe('string');
            expect(hashResult.length).toBeGreaterThan(0);
            expect(/^[0-9a-f]+$/.test(hashResult)).toBe(true);
        });

        it('should produce consistent hashes for same object', async () => {
            const obj = { name: 'test', value: 42 };
            const hash1 = await hashObject(obj);
            const hash2 = await hashObject(obj);

            expect(hash1).toBe(hash2);
        });

        it('should produce same hash for objects with same content but different order', async () => {
            const obj1 = { name: 'test', value: 42 };
            const obj2 = { value: 42, name: 'test' };
            const hash1 = await hashObject(obj1);
            const hash2 = await hashObject(obj2);

            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for different objects', async () => {
            const obj1 = { name: 'test1', value: 42 };
            const obj2 = { name: 'test2', value: 42 };
            const hash1 = await hashObject(obj1);
            const hash2 = await hashObject(obj2);

            expect(hash1).not.toBe(hash2);
        });

        it('should handle nested objects', async () => {
            const obj = {
                name: 'test',
                nested: { inner: 'value', number: 123 },
            };
            const hashResult = await hashObject(obj);

            expect(typeof hashResult).toBe('string');
            expect(hashResult.length).toBeGreaterThan(0);
        });

        it('should default to base64 format', async () => {
            const obj = { name: 'test', value: 42 };
            const hashWithDefault = await hashObject(obj);
            const hashWithExplicit = await hashObject(obj, 'base64');

            expect(hashWithDefault).toBe(hashWithExplicit);
        });
    });
});
