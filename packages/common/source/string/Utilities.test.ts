// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { stringConcat, stringHash } from './Utilities';

describe('Utilities', () => {
    describe('stringHash', () => {
        test('should generate consistent hash for same input', () => {
            const input = 'test string';
            const hash1 = stringHash(input);
            const hash2 = stringHash(input);
            expect(hash1).toBe(hash2);
        });

        test('should generate different hashes for different inputs', () => {
            const hash1 = stringHash('hello');
            const hash2 = stringHash('world');
            expect(hash1).not.toBe(hash2);
        });

        test('should return 0 for empty string', () => {
            expect(stringHash('')).toBe(0);
        });

        test('should generate numeric hash', () => {
            const hash = stringHash('test');
            expect(typeof hash).toBe('number');
        });
    });

    describe('stringConcat', () => {
        test('should concatenate strings with default joiner', () => {
            expect(stringConcat(['hello', 'world'])).toBe('hello, world');
            expect(stringConcat(['a', 'b', 'c'])).toBe('a, b, c');
        });

        test('should concatenate strings with custom joiner', () => {
            expect(stringConcat(['hello', 'world'], ' - ')).toBe(
                'hello - world',
            );
            expect(stringConcat(['a', 'b', 'c'], '|')).toBe('a|b|c');
        });

        test('should handle empty or undefined arrays', () => {
            expect(stringConcat([])).toBe('');
            expect(stringConcat(undefined)).toBe('');
        });

        test('should handle single element array', () => {
            expect(stringConcat(['single'])).toBe('single');
        });

        test('should work with readonly arrays', () => {
            const readonlyArray: ReadonlyArray<string> = ['readonly', 'array'];
            expect(stringConcat(readonlyArray)).toBe('readonly, array');
        });
    });
});
