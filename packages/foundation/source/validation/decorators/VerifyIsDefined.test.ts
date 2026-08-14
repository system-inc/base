// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyIsDefined } from './VerifyIsDefined';

describe('VerifyIsDefined', () => {
    test('accepts a string', () => {
        expect(VerifyIsDefined.check('hello')).toBe(true);
    });

    test('accepts zero', () => {
        expect(VerifyIsDefined.check(0)).toBe(true);
    });

    test('accepts false', () => {
        expect(VerifyIsDefined.check(false)).toBe(true);
    });

    test('accepts an empty string', () => {
        expect(VerifyIsDefined.check('')).toBe(true);
    });

    test('accepts an empty object', () => {
        expect(VerifyIsDefined.check({})).toBe(true);
    });

    test('rejects null', () => {
        expect(VerifyIsDefined.check(null)).toBe(false);
    });

    test('rejects undefined', () => {
        expect(VerifyIsDefined.check(undefined)).toBe(false);
    });
});
