// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyIsBoolean } from './VerifyIsBoolean';

describe('VerifyIsBoolean', () => {
    test('accepts true', () => {
        expect(VerifyIsBoolean.check(true)).toBe(true);
    });

    test('accepts false', () => {
        expect(VerifyIsBoolean.check(false)).toBe(true);
    });

    test('rejects a truthy string', () => {
        expect(VerifyIsBoolean.check('true')).toBe(false);
    });

    test('rejects 0', () => {
        expect(VerifyIsBoolean.check(0)).toBe(false);
    });

    test('rejects 1', () => {
        expect(VerifyIsBoolean.check(1)).toBe(false);
    });

    test('rejects null', () => {
        expect(VerifyIsBoolean.check(null)).toBe(false);
    });

    test('rejects undefined', () => {
        expect(VerifyIsBoolean.check(undefined)).toBe(false);
    });
});
