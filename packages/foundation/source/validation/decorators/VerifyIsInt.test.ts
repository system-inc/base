// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyIsInt } from './VerifyIsInt';

describe('VerifyIsInt', () => {
    test('accepts a positive integer', () => {
        expect(VerifyIsInt.check(42)).toBe(true);
    });

    test('accepts zero', () => {
        expect(VerifyIsInt.check(0)).toBe(true);
    });

    test('accepts a negative integer', () => {
        expect(VerifyIsInt.check(-7)).toBe(true);
    });

    test('rejects a float', () => {
        expect(VerifyIsInt.check(3.14)).toBe(false);
    });

    test('rejects NaN', () => {
        expect(VerifyIsInt.check(NaN)).toBe(false);
    });

    test('rejects Infinity', () => {
        expect(VerifyIsInt.check(Infinity)).toBe(false);
    });

    test('rejects a numeric string', () => {
        expect(VerifyIsInt.check('42')).toBe(false);
    });

    test('rejects null', () => {
        expect(VerifyIsInt.check(null)).toBe(false);
    });
});
