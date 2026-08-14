// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyIsString } from './VerifyIsString';

describe('VerifyIsString', () => {
    test('accepts a non-empty string', () => {
        expect(VerifyIsString.check('hello')).toBe(true);
    });

    test('accepts an empty string', () => {
        expect(VerifyIsString.check('')).toBe(true);
    });

    test('rejects a number', () => {
        expect(VerifyIsString.check(42)).toBe(false);
    });

    test('rejects a boolean', () => {
        expect(VerifyIsString.check(true)).toBe(false);
    });

    test('rejects null', () => {
        expect(VerifyIsString.check(null)).toBe(false);
    });

    test('rejects undefined', () => {
        expect(VerifyIsString.check(undefined)).toBe(false);
    });

    test('rejects an object', () => {
        expect(VerifyIsString.check({})).toBe(false);
    });
});
