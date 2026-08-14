// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { numberClamp } from './Clamp';

describe('numberClamp test', () => {
    test('should clamp value to maximum when value exceeds max', () => {
        expect(numberClamp(10, 0, 5)).toBe(5);
        expect(numberClamp(300, 0, 255)).toBe(255);
        expect(numberClamp(1000, -10, 50)).toBe(50);
    });

    test('should clamp value to minimum when value is below min', () => {
        expect(numberClamp(-5, 0, 10)).toBe(0);
        expect(numberClamp(-100, 0, 255)).toBe(0);
        expect(numberClamp(-50, -10, 50)).toBe(-10);
    });

    test('should return original value when within range', () => {
        expect(numberClamp(5, 0, 10)).toBe(5);
        expect(numberClamp(128, 0, 255)).toBe(128);
        expect(numberClamp(0, -10, 10)).toBe(0);
        expect(numberClamp(25, 20, 30)).toBe(25);
    });

    test('should handle edge cases at boundaries', () => {
        expect(numberClamp(0, 0, 10)).toBe(0);
        expect(numberClamp(10, 0, 10)).toBe(10);
        expect(numberClamp(-5, -5, 5)).toBe(-5);
        expect(numberClamp(5, -5, 5)).toBe(5);
    });

    test('should handle negative ranges', () => {
        expect(numberClamp(-15, -10, -5)).toBe(-10);
        expect(numberClamp(-3, -10, -5)).toBe(-5);
        expect(numberClamp(-7, -10, -5)).toBe(-7);
    });

    test('should handle decimal numbers', () => {
        expect(numberClamp(1.5, 0, 2)).toBe(1.5);
        expect(numberClamp(2.5, 0, 2)).toBe(2);
        expect(numberClamp(-0.5, 0, 2)).toBe(0);
        expect(numberClamp(3.14159, 0, 3.14)).toBe(3.14);
    });

    test('should handle when min equals max', () => {
        expect(numberClamp(5, 3, 3)).toBe(3);
        expect(numberClamp(1, 3, 3)).toBe(3);
        expect(numberClamp(3, 3, 3)).toBe(3);
    });

    test('should handle zero values', () => {
        expect(numberClamp(0, -5, 5)).toBe(0);
        expect(numberClamp(0, 0, 0)).toBe(0);
        expect(numberClamp(5, 0, 0)).toBe(0);
        expect(numberClamp(-5, 0, 0)).toBe(0);
    });

    test('should handle large numbers', () => {
        expect(numberClamp(Number.MAX_SAFE_INTEGER, 0, 1000)).toBe(1000);
        expect(numberClamp(Number.MIN_SAFE_INTEGER, -1000, 1000)).toBe(-1000);
        expect(numberClamp(1e6, 0, 1e7)).toBe(1e6);
        expect(numberClamp(1e8, 0, 1e7)).toBe(1e7);
    });

    test('should handle special numeric values', () => {
        expect(numberClamp(Infinity, 0, 100)).toBe(100);
        expect(numberClamp(-Infinity, 0, 100)).toBe(0);
        expect(numberClamp(Infinity, -Infinity, Infinity)).toBe(Infinity);
        expect(numberClamp(-Infinity, -Infinity, Infinity)).toBe(-Infinity);
    });

    test('should handle NaN values', () => {
        expect(numberClamp(NaN, 0, 100)).toBeNaN();
        expect(numberClamp(50, NaN, 100)).toBeNaN();
        expect(numberClamp(50, 0, NaN)).toBeNaN();
        expect(numberClamp(NaN, NaN, NaN)).toBeNaN();
    });

    test('should work with the example from the documentation', () => {
        const x = 2;
        const result = numberClamp(x * 255, 0, 255);
        expect(result).toBe(255);
    });

    test('should handle inverted min/max parameters gracefully', () => {
        expect(numberClamp(5, 10, 0)).toBe(0);
        expect(numberClamp(-5, 10, 0)).toBe(0);
        expect(numberClamp(15, 10, 0)).toBe(0);
    });
});
