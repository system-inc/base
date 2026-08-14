// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { arrayCompact } from './Compact';

describe('arrayCompact test', () => {
    test('should remove null values from array', () => {
        const input = [1, null, 2, 3, null];
        const result = arrayCompact(input);
        expect(result).toEqual([1, 2, 3]);
    });

    test('should remove undefined values from array', () => {
        const input = [1, undefined, 2, 3, undefined];
        const result = arrayCompact(input);
        expect(result).toEqual([1, 2, 3]);
    });

    test('should remove both null and undefined values', () => {
        const input = [1, null, 2, undefined, 3, null, undefined];
        const result = arrayCompact(input);
        expect(result).toEqual([1, 2, 3]);
    });

    test('should preserve zero values', () => {
        const input = [0, null, undefined];
        const result = arrayCompact(input);
        expect(result).toEqual([0]);
    });

    test('should preserve false values', () => {
        const input = [false, null, undefined, true];
        const result = arrayCompact(input);
        expect(result).toEqual([false, true]);
    });

    test('should preserve empty strings', () => {
        const input = ['', null, undefined, 'hello'];
        const result = arrayCompact(input);
        expect(result).toEqual(['', 'hello']);
    });

    test('should handle empty array', () => {
        const input: (string | null | undefined)[] = [];
        const result = arrayCompact(input);
        expect(result).toEqual([]);
    });

    test('should handle array with only null values', () => {
        const input = [null, null, null];
        const result = arrayCompact(input);
        expect(result).toEqual([]);
    });

    test('should handle array with only undefined values', () => {
        const input = [undefined, undefined, undefined];
        const result = arrayCompact(input);
        expect(result).toEqual([]);
    });

    test('should handle array with no null or undefined values', () => {
        const input = [1, 2, 3, 'hello', true];
        const result = arrayCompact(input);
        expect(result).toEqual([1, 2, 3, 'hello', true]);
    });

    test('should work with readonly arrays', () => {
        const input: ReadonlyArray<string | null | undefined> = [
            'a',
            null,
            'b',
            undefined,
            'c',
        ];
        const result = arrayCompact(input);
        expect(result).toEqual(['a', 'b', 'c']);
    });

    test('should handle complex objects', () => {
        const obj1 = { id: 1, name: 'test' };
        const obj2 = { id: 2, name: 'test2' };
        const input = [obj1, null, obj2, undefined];
        const result = arrayCompact(input);
        expect(result).toEqual([obj1, obj2]);
    });

    test('should maintain type safety', () => {
        const input: (number | null | undefined)[] = [1, null, 2, undefined, 3];
        const result = arrayCompact(input);
        expect(result).toEqual([1, 2, 3]);
        expect(typeof result[0]).toBe('number');
    });
});
