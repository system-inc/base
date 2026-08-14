// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyIsArray } from './VerifyIsArray';

describe('VerifyIsArray', () => {
    test('accepts an empty array', () => {
        expect(VerifyIsArray.check([])).toBe(true);
    });

    test('accepts an array of numbers', () => {
        expect(VerifyIsArray.check([1, 2, 3])).toBe(true);
    });

    test('accepts a mixed-type array', () => {
        expect(VerifyIsArray.check([1, 'two', true])).toBe(true);
    });

    test('rejects a plain object', () => {
        expect(VerifyIsArray.check({})).toBe(false);
    });

    test('rejects a string', () => {
        expect(VerifyIsArray.check('abc')).toBe(false);
    });

    test('rejects a number', () => {
        expect(VerifyIsArray.check(42)).toBe(false);
    });

    test('rejects null', () => {
        expect(VerifyIsArray.check(null)).toBe(false);
    });

    test('rejects undefined', () => {
        expect(VerifyIsArray.check(undefined)).toBe(false);
    });
});
