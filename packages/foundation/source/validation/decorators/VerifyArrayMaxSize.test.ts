// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyArrayMaxSize } from './VerifyArrayMaxSize';

describe('VerifyArrayMaxSize', () => {
    test('accepts an array at the maximum size', () => {
        expect(VerifyArrayMaxSize.check([1, 2, 3], 3)).toBe(true);
    });

    test('accepts an array smaller than the maximum', () => {
        expect(VerifyArrayMaxSize.check([1], 3)).toBe(true);
    });

    test('accepts an empty array', () => {
        expect(VerifyArrayMaxSize.check([], 3)).toBe(true);
    });

    test('rejects an array larger than the maximum', () => {
        expect(VerifyArrayMaxSize.check([1, 2, 3, 4], 3)).toBe(false);
    });

    test('rejects a non-array', () => {
        expect(VerifyArrayMaxSize.check('abc', 3)).toBe(false);
    });

    test('rejects null', () => {
        expect(VerifyArrayMaxSize.check(null, 3)).toBe(false);
    });

    test('changes behavior with different options', () => {
        expect(VerifyArrayMaxSize.check([1, 2, 3], 5)).toBe(true);
        expect(VerifyArrayMaxSize.check([1, 2, 3], 2)).toBe(false);
    });
});
