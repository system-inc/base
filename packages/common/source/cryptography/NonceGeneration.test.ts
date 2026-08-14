// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { generateNonce } from './NonceGeneration';

describe('NonceGeneration', () => {
    describe('generateNonce', () => {
        it('should generate a nonce as hex string', () => {
            const nonce = generateNonce();

            expect(typeof nonce).toBe('string');
            expect(nonce.length).toBe(32); // 16 bytes * 2 hex chars per byte
            expect(/^[0-9a-f]+$/.test(nonce)).toBe(true);
        });

        it('should generate different nonces on multiple calls', () => {
            const nonce1 = generateNonce();
            const nonce2 = generateNonce();
            const nonce3 = generateNonce();

            expect(nonce1).not.toBe(nonce2);
            expect(nonce2).not.toBe(nonce3);
            expect(nonce1).not.toBe(nonce3);
        });

        it('should generate nonces with consistent length', () => {
            for (let i = 0; i < 10; i++) {
                const nonce = generateNonce();
                expect(nonce.length).toBe(32);
            }
        });

        it('should generate nonces with only hexadecimal characters', () => {
            for (let i = 0; i < 10; i++) {
                const nonce = generateNonce();
                expect(/^[0-9a-f]+$/.test(nonce)).toBe(true);
            }
        });

        it('should generate nonces with proper padding', () => {
            // Test that single digit hex values are padded with leading zero
            const nonce = generateNonce();

            // Split into pairs and check each is 2 characters
            for (let i = 0; i < nonce.length; i += 2) {
                const hexPair = nonce.substr(i, 2);
                expect(hexPair.length).toBe(2);
                expect(/^[0-9a-f]{2}$/.test(hexPair)).toBe(true);
            }
        });

        it('should have high entropy (statistical test)', () => {
            const nonces = [];
            const iterations = 100;

            // Generate multiple nonces
            for (let i = 0; i < iterations; i++) {
                nonces.push(generateNonce());
            }

            // Check that all nonces are unique
            const uniqueNonces = new Set(nonces);
            expect(uniqueNonces.size).toBe(iterations);

            // Check character distribution (should be roughly even for good entropy)
            const charCounts: { [key: string]: number } = {};
            const allChars = nonces.join('');

            for (const char of allChars) {
                charCounts[char] = (charCounts[char] || 0) + 1;
            }

            // Should have all 16 hex characters represented
            const hexChars = '0123456789abcdef';
            for (const hexChar of hexChars) {
                expect(charCounts[hexChar]).toBeGreaterThan(0);
            }
        });
    });
});
