// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyLength } from './VerifyLength';

describe('VerifyLength', () => {
    test('accepts a string at the minimum length', () => {
        expect(VerifyLength.check('abc', 3, 5)).toBe(true);
    });

    test('accepts a string at the maximum length', () => {
        expect(VerifyLength.check('abcde', 3, 5)).toBe(true);
    });

    test('accepts a string within the range', () => {
        expect(VerifyLength.check('abcd', 3, 5)).toBe(true);
    });

    test('rejects a string shorter than the minimum', () => {
        expect(VerifyLength.check('ab', 3, 5)).toBe(false);
    });

    test('rejects a string longer than the maximum', () => {
        expect(VerifyLength.check('abcdef', 3, 5)).toBe(false);
    });

    test('treats omitted max as open-ended', () => {
        expect(VerifyLength.check('abcdefghij', 3)).toBe(true);
        expect(VerifyLength.check('ab', 3)).toBe(false);
    });

    test('accepts arrays too', () => {
        expect(VerifyLength.check([1, 2, 3], 2, 4)).toBe(true);
        expect(VerifyLength.check([1], 2, 4)).toBe(false);
    });

    test('rejects a non-string, non-array', () => {
        expect(VerifyLength.check(42, 1, 5)).toBe(false);
    });
});
