// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyMin } from './VerifyMin';

describe('VerifyMin', () => {
    test('accepts a value above the minimum', () => {
        expect(VerifyMin.check(10, 5)).toBe(true);
    });

    test('accepts a value equal to the minimum', () => {
        expect(VerifyMin.check(5, 5)).toBe(true);
    });

    test('rejects a value below the minimum', () => {
        expect(VerifyMin.check(4, 5)).toBe(false);
    });

    test('rejects a numeric string', () => {
        expect(VerifyMin.check('10', 5)).toBe(false);
    });

    test('rejects null', () => {
        expect(VerifyMin.check(null, 5)).toBe(false);
    });

    test('handles negative minimums', () => {
        expect(VerifyMin.check(-3, -5)).toBe(true);
        expect(VerifyMin.check(-6, -5)).toBe(false);
    });

    test('changes behavior with different options', () => {
        expect(VerifyMin.check(7, 5)).toBe(true);
        expect(VerifyMin.check(7, 10)).toBe(false);
    });
});
