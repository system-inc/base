// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { arrayGetRandom, arrayRequireRandom } from './Random';

describe('arrayGetRandom', () => {
    test('should return undefined for empty array', () => {
        const result = arrayGetRandom([]);
        expect(result).toBeUndefined();
    });

    test('should return the single element for single-element array', () => {
        const result = arrayGetRandom(['only']);
        expect(result).toBe('only');
    });

    test('should return an element from the array', () => {
        const array = [1, 2, 3, 4, 5];
        const result = arrayGetRandom(array);
        expect(array).toContain(result);
    });

    test('should work with different data types', () => {
        const stringArray = ['a', 'b', 'c'];
        const stringResult = arrayGetRandom(stringArray);
        expect(stringArray).toContain(stringResult);

        const numberArray = [10, 20, 30];
        const numberResult = arrayGetRandom(numberArray);
        expect(numberArray).toContain(numberResult);

        const objectArray = [{ id: 1 }, { id: 2 }];
        const objectResult = arrayGetRandom(objectArray);
        expect(objectArray).toContain(objectResult);
    });

    test('should work with readonly arrays', () => {
        const readonlyArray: ReadonlyArray<string> = ['x', 'y', 'z'];
        const result = arrayGetRandom(readonlyArray);
        expect(readonlyArray).toContain(result);
    });

    test('should return different values over multiple calls (probabilistic)', () => {
        const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const results = new Set();

        for (let i = 0; i < 50; i++) {
            results.add(arrayGetRandom(array));
        }

        expect(results.size).toBeGreaterThan(1);
    });

    test('should handle array with duplicate values', () => {
        const array = [1, 1, 1, 2, 2];
        const result = arrayGetRandom(array);
        expect([1, 2]).toContain(result);
    });
});

describe('arrayRequireRandom', () => {
    test('should throw error for empty array', () => {
        expect(() => arrayRequireRandom([])).toThrow(
            'Array cannot be empty when requiring a random element.',
        );
    });

    test('should return the single element for single-element array', () => {
        const result = arrayRequireRandom(['only']);
        expect(result).toBe('only');
    });

    test('should return an element from the array', () => {
        const array = [1, 2, 3, 4, 5];
        const result = arrayRequireRandom(array);
        expect(array).toContain(result);
    });

    test('should work with different data types', () => {
        const stringArray = ['a', 'b', 'c'];
        const stringResult = arrayRequireRandom(stringArray);
        expect(stringArray).toContain(stringResult);

        const numberArray = [10, 20, 30];
        const numberResult = arrayRequireRandom(numberArray);
        expect(numberArray).toContain(numberResult);

        const objectArray = [{ id: 1 }, { id: 2 }];
        const objectResult = arrayRequireRandom(objectArray);
        expect(objectArray).toContain(objectResult);
    });

    test('should work with readonly arrays', () => {
        const readonlyArray: ReadonlyArray<string> = ['x', 'y', 'z'];
        const result = arrayRequireRandom(readonlyArray);
        expect(readonlyArray).toContain(result);
    });

    test('should return different values over multiple calls (probabilistic)', () => {
        const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        const results = new Set();

        for (let i = 0; i < 50; i++) {
            results.add(arrayRequireRandom(array));
        }

        expect(results.size).toBeGreaterThan(1);
    });

    test('should handle array with duplicate values', () => {
        const array = [1, 1, 1, 2, 2];
        const result = arrayRequireRandom(array);
        expect([1, 2]).toContain(result);
    });

    test('should never return undefined', () => {
        const array = [1, 2, 3];
        for (let i = 0; i < 10; i++) {
            const result = arrayRequireRandom(array);
            expect(result).toBeDefined();
        }
    });
});
