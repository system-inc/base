// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyMinLength } from './VerifyMinLength';

describe('VerifyMinLength', () => {
    test('accepts a string at the minimum length', () => {
        expect(VerifyMinLength.check('abc', 3)).toBe(true);
    });

    test('accepts a string longer than the minimum', () => {
        expect(VerifyMinLength.check('abcdef', 3)).toBe(true);
    });

    test('rejects a string shorter than the minimum', () => {
        expect(VerifyMinLength.check('ab', 3)).toBe(false);
    });

    test('accepts an array at the minimum length', () => {
        expect(VerifyMinLength.check([1, 2, 3], 3)).toBe(true);
    });

    test('rejects an array shorter than the minimum', () => {
        expect(VerifyMinLength.check([1, 2], 3)).toBe(false);
    });

    test('rejects a number', () => {
        expect(VerifyMinLength.check(42, 3)).toBe(false);
    });

    test('rejects null', () => {
        expect(VerifyMinLength.check(null, 3)).toBe(false);
    });

    test('changes behavior with different options', () => {
        expect(VerifyMinLength.check('hello', 3)).toBe(true);
        expect(VerifyMinLength.check('hello', 10)).toBe(false);
    });
});
