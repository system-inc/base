// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyArrayUnique } from './VerifyArrayUnique';

describe('VerifyArrayUnique', () => {
    test('accepts an array with unique primitives', () => {
        expect(VerifyArrayUnique.check([1, 2, 3])).toBe(true);
    });

    test('accepts an empty array', () => {
        expect(VerifyArrayUnique.check([])).toBe(true);
    });

    test('accepts a single-element array', () => {
        expect(VerifyArrayUnique.check(['only'])).toBe(true);
    });

    test('accepts unique strings', () => {
        expect(VerifyArrayUnique.check(['a', 'b', 'c'])).toBe(true);
    });

    test('rejects an array with duplicate numbers', () => {
        expect(VerifyArrayUnique.check([1, 2, 2, 3])).toBe(false);
    });

    test('rejects an array with duplicate strings', () => {
        expect(VerifyArrayUnique.check(['a', 'b', 'a'])).toBe(false);
    });

    test('rejects a non-array', () => {
        expect(VerifyArrayUnique.check('abc')).toBe(false);
    });

    test('rejects null', () => {
        expect(VerifyArrayUnique.check(null)).toBe(false);
    });
});
