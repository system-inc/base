// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyArrayMinSize } from './VerifyArrayMinSize';

describe('VerifyArrayMinSize', () => {
    test('accepts an array at the minimum size', () => {
        expect(VerifyArrayMinSize.check([1, 2, 3], 3)).toBe(true);
    });

    test('accepts an array larger than the minimum', () => {
        expect(VerifyArrayMinSize.check([1, 2, 3, 4], 3)).toBe(true);
    });

    test('rejects an array smaller than the minimum', () => {
        expect(VerifyArrayMinSize.check([1], 3)).toBe(false);
    });

    test('rejects an empty array when minimum > 0', () => {
        expect(VerifyArrayMinSize.check([], 1)).toBe(false);
    });

    test('rejects a non-array', () => {
        expect(VerifyArrayMinSize.check('abc', 1)).toBe(false);
    });

    test('rejects null', () => {
        expect(VerifyArrayMinSize.check(null, 1)).toBe(false);
    });

    test('changes behavior with different options', () => {
        expect(VerifyArrayMinSize.check([1, 2], 2)).toBe(true);
        expect(VerifyArrayMinSize.check([1, 2], 5)).toBe(false);
    });
});
