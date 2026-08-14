// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    GENERAL_RANDOM_CHARSET,
    generateRandomIdentifier,
    generateRandomToken,
    LOWERCASE_RANDOM_CHARSET,
    randomInt,
} from './RandomGeneration';

describe('RandomGeneration', () => {
    describe('GENERAL_RANDOM_CHARSET', () => {
        it('should contain uppercase letters, lowercase letters, and numbers', () => {
            expect(GENERAL_RANDOM_CHARSET).toBe(
                'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
            );
            expect(GENERAL_RANDOM_CHARSET).toHaveLength(62);
        });
    });

    describe('LOWERCASE_RANDOM_CHARSET', () => {
        it('should contain only lowercase letters and numbers', () => {
            expect(LOWERCASE_RANDOM_CHARSET).toBe(
                'abcdefghijklmnopqrstuvwxyz0123456789',
            );
            expect(LOWERCASE_RANDOM_CHARSET).toHaveLength(36);
        });
    });

    describe('generateRandomToken', () => {
        it('should generate a token of the specified length', async () => {
            const token = await generateRandomToken(10);
            expect(token).toHaveLength(10);
        });

        it('should generate a token with only characters from GENERAL_RANDOM_CHARSET', async () => {
            const token = await generateRandomToken(50);
            for (const char of token) {
                expect(GENERAL_RANDOM_CHARSET).toContain(char);
            }
        });

        it('should generate different tokens on multiple calls', async () => {
            const token1 = await generateRandomToken(20);
            const token2 = await generateRandomToken(20);
            expect(token1).not.toBe(token2);
        });

        it('should handle zero length', async () => {
            const token = await generateRandomToken(0);
            expect(token).toBe('');
        });

        it('should handle length of 1', async () => {
            const token = await generateRandomToken(1);
            expect(token).toHaveLength(1);
            expect(GENERAL_RANDOM_CHARSET).toContain(token);
        });
    });

    describe('generateRandomIdentifier', () => {
        it('should generate an identifier of the specified length', async () => {
            const identifier = await generateRandomIdentifier(8);
            expect(identifier).toHaveLength(8);
        });

        it('should use GENERAL_RANDOM_CHARSET by default', async () => {
            const identifier = await generateRandomIdentifier(30);
            for (const char of identifier) {
                expect(GENERAL_RANDOM_CHARSET).toContain(char);
            }
        });

        it('should use customized charset when provided', async () => {
            const customCharset = 'ABC123';
            const identifier = await generateRandomIdentifier(
                20,
                customCharset,
            );
            for (const char of identifier) {
                expect(customCharset).toContain(char);
            }
        });

        it('should use LOWERCASE_RANDOM_CHARSET when provided', async () => {
            const identifier = await generateRandomIdentifier(
                15,
                LOWERCASE_RANDOM_CHARSET,
            );
            for (const char of identifier) {
                expect(LOWERCASE_RANDOM_CHARSET).toContain(char);
            }
        });

        it('should generate different identifiers on multiple calls', async () => {
            const id1 = await generateRandomIdentifier(12);
            const id2 = await generateRandomIdentifier(12);
            expect(id1).not.toBe(id2);
        });

        it('should handle zero length', async () => {
            const identifier = await generateRandomIdentifier(0);
            expect(identifier).toBe('');
        });

        it('should handle length of 1 with custom charset', async () => {
            const customCharset = 'X';
            const identifier = await generateRandomIdentifier(1, customCharset);
            expect(identifier).toBe('X');
        });

        it('should handle undefined customizedCharset parameter', async () => {
            const identifier = await generateRandomIdentifier(10, undefined);
            expect(identifier).toHaveLength(10);
            for (const char of identifier) {
                expect(GENERAL_RANDOM_CHARSET).toContain(char);
            }
        });
    });

    describe('CSPRNG sourcing', () => {
        it('draws entropy from crypto.getRandomValues, not Math.random', async () => {
            const cryptoSpy = jest.spyOn(crypto, 'getRandomValues');
            const mathSpy = jest.spyOn(Math, 'random');
            try {
                await generateRandomToken(16);
                expect(cryptoSpy).toHaveBeenCalled();
                expect(mathSpy).not.toHaveBeenCalled();
            } finally {
                cryptoSpy.mockRestore();
                mathSpy.mockRestore();
            }
        });

        it('rejects a charset longer than a byte can index', async () => {
            const tooLong = 'a'.repeat(257);
            await expect(generateRandomIdentifier(4, tooLong)).rejects.toThrow(
                RangeError,
            );
        });
    });

    describe('randomInt', () => {
        it('should return values within [min, max)', () => {
            for (let i = 0; i < 100; i++) {
                const value = randomInt(5, 10);
                expect(value).toBeGreaterThanOrEqual(5);
                expect(value).toBeLessThan(10);
            }
        });

        it('should only return integers', () => {
            for (let i = 0; i < 100; i++) {
                const value = randomInt(0, 100);
                expect(Number.isInteger(value)).toBe(true);
            }
        });

        it('should return min when range is 1', () => {
            const value = randomInt(7, 8);
            expect(value).toBe(7);
        });

        it('should work with negative ranges', () => {
            for (let i = 0; i < 100; i++) {
                const value = randomInt(-5, 0);
                expect(value).toBeGreaterThanOrEqual(-5);
                expect(value).toBeLessThan(0);
            }
        });
    });
});
