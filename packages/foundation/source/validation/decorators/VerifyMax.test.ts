// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyMax } from './VerifyMax';

describe('VerifyMax', () => {
    test('accepts a value below the maximum', () => {
        expect(VerifyMax.check(3, 5)).toBe(true);
    });

    test('accepts a value equal to the maximum', () => {
        expect(VerifyMax.check(5, 5)).toBe(true);
    });

    test('rejects a value above the maximum', () => {
        expect(VerifyMax.check(6, 5)).toBe(false);
    });

    test('rejects a numeric string', () => {
        expect(VerifyMax.check('3', 5)).toBe(false);
    });

    test('rejects null', () => {
        expect(VerifyMax.check(null, 5)).toBe(false);
    });

    test('handles negative maximums', () => {
        expect(VerifyMax.check(-10, -5)).toBe(true);
        expect(VerifyMax.check(-3, -5)).toBe(false);
    });

    test('changes behavior with different options', () => {
        expect(VerifyMax.check(7, 10)).toBe(true);
        expect(VerifyMax.check(7, 5)).toBe(false);
    });
});
