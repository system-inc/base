// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyIsNotEmpty } from './VerifyIsNotEmpty';

describe('VerifyIsNotEmpty', () => {
    test('accepts a non-empty string', () => {
        expect(VerifyIsNotEmpty.check('abc')).toBe(true);
    });

    test('accepts a non-empty array', () => {
        expect(VerifyIsNotEmpty.check([1])).toBe(true);
    });

    test('accepts a non-empty object', () => {
        expect(VerifyIsNotEmpty.check({ a: 1 })).toBe(true);
    });

    test('accepts zero', () => {
        expect(VerifyIsNotEmpty.check(0)).toBe(true);
    });

    test('accepts false', () => {
        expect(VerifyIsNotEmpty.check(false)).toBe(true);
    });

    test('rejects null', () => {
        expect(VerifyIsNotEmpty.check(null)).toBe(false);
    });

    test('rejects undefined', () => {
        expect(VerifyIsNotEmpty.check(undefined)).toBe(false);
    });

    test('rejects an empty string', () => {
        expect(VerifyIsNotEmpty.check('')).toBe(false);
    });

    test('rejects an empty array', () => {
        expect(VerifyIsNotEmpty.check([])).toBe(false);
    });

    test('rejects an empty plain object', () => {
        expect(VerifyIsNotEmpty.check({})).toBe(false);
    });
});
