// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyMaxLength } from './VerifyMaxLength';

describe('VerifyMaxLength', () => {
    test('accepts a string at the maximum length', () => {
        expect(VerifyMaxLength.check('abc', 3)).toBe(true);
    });

    test('accepts a string shorter than the maximum', () => {
        expect(VerifyMaxLength.check('ab', 3)).toBe(true);
    });

    test('rejects a string longer than the maximum', () => {
        expect(VerifyMaxLength.check('abcdef', 3)).toBe(false);
    });

    test('accepts an array at the maximum length', () => {
        expect(VerifyMaxLength.check([1, 2, 3], 3)).toBe(true);
    });

    test('rejects an array longer than the maximum', () => {
        expect(VerifyMaxLength.check([1, 2, 3, 4], 3)).toBe(false);
    });

    test('rejects a number', () => {
        expect(VerifyMaxLength.check(42, 3)).toBe(false);
    });

    test('rejects null', () => {
        expect(VerifyMaxLength.check(null, 3)).toBe(false);
    });

    test('changes behavior with different options', () => {
        expect(VerifyMaxLength.check('hello', 10)).toBe(true);
        expect(VerifyMaxLength.check('hello', 3)).toBe(false);
    });
});
