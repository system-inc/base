// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyIsObject } from './VerifyIsObject';

describe('VerifyIsObject', () => {
    test('accepts a plain object', () => {
        expect(VerifyIsObject.check({ a: 1 })).toBe(true);
    });

    test('accepts an empty object', () => {
        expect(VerifyIsObject.check({})).toBe(true);
    });

    test('accepts a class instance', () => {
        class Foo {}
        expect(VerifyIsObject.check(new Foo())).toBe(true);
    });

    test('rejects an array', () => {
        expect(VerifyIsObject.check([1, 2, 3])).toBe(false);
    });

    test('rejects null', () => {
        expect(VerifyIsObject.check(null)).toBe(false);
    });

    test('rejects a string', () => {
        expect(VerifyIsObject.check('abc')).toBe(false);
    });

    test('rejects a number', () => {
        expect(VerifyIsObject.check(42)).toBe(false);
    });

    test('rejects undefined', () => {
        expect(VerifyIsObject.check(undefined)).toBe(false);
    });
});
