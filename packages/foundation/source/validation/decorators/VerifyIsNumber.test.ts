// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyIsNumber } from './VerifyIsNumber';

describe('VerifyIsNumber', () => {
    test('accepts an integer', () => {
        expect(VerifyIsNumber.check(42)).toBe(true);
    });

    test('accepts a float', () => {
        expect(VerifyIsNumber.check(3.14)).toBe(true);
    });

    test('accepts zero', () => {
        expect(VerifyIsNumber.check(0)).toBe(true);
    });

    test('accepts a negative number', () => {
        expect(VerifyIsNumber.check(-10)).toBe(true);
    });

    test('rejects NaN', () => {
        expect(VerifyIsNumber.check(NaN)).toBe(false);
    });

    test('rejects Infinity', () => {
        expect(VerifyIsNumber.check(Infinity)).toBe(false);
    });

    test('rejects a numeric string', () => {
        expect(VerifyIsNumber.check('42')).toBe(false);
    });

    test('rejects null', () => {
        expect(VerifyIsNumber.check(null)).toBe(false);
    });
});
