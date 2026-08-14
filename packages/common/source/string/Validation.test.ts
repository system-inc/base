// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    stringContainsWhitespace,
    stringIsAlphaNumericWithHyphens,
} from './Validation';

describe('Validation', () => {
    describe('stringContainsWhitespace', () => {
        test('should return true for strings containing whitespace', () => {
            expect(stringContainsWhitespace('hello world')).toBe(true);
            expect(stringContainsWhitespace('a b')).toBe(true);
            expect(stringContainsWhitespace(' leading')).toBe(true);
            expect(stringContainsWhitespace('trailing ')).toBe(true);
            expect(stringContainsWhitespace('middle space')).toBe(true);
        });

        test('should return true for strings with tabs and newlines', () => {
            expect(stringContainsWhitespace('hello\tworld')).toBe(true);
            expect(stringContainsWhitespace('hello\nworld')).toBe(true);
            expect(stringContainsWhitespace('hello\r\nworld')).toBe(true);
        });

        test('should return false for strings without whitespace', () => {
            expect(stringContainsWhitespace('hello')).toBe(false);
            expect(stringContainsWhitespace('helloworld')).toBe(false);
            expect(stringContainsWhitespace('123456')).toBe(false);
            expect(stringContainsWhitespace('')).toBe(false);
        });
    });

    describe('stringIsAlphaNumericWithHyphens', () => {
        test('should return true for valid alphanumeric strings with hyphens and dots', () => {
            expect(stringIsAlphaNumericWithHyphens('hello-world')).toBe(true);
            expect(stringIsAlphaNumericWithHyphens('test123')).toBe(true);
            expect(stringIsAlphaNumericWithHyphens('ABC-123-xyz')).toBe(true);
            expect(stringIsAlphaNumericWithHyphens('simple')).toBe(true);
            expect(stringIsAlphaNumericWithHyphens('123')).toBe(true);
            expect(stringIsAlphaNumericWithHyphens('hello.world')).toBe(true);
            expect(stringIsAlphaNumericWithHyphens('www.google.com')).toBe(
                true,
            );
        });

        test('should return false for strings with invalid characters', () => {
            expect(stringIsAlphaNumericWithHyphens('hello world')).toBe(false);
            expect(stringIsAlphaNumericWithHyphens('hello_world')).toBe(false);
            expect(stringIsAlphaNumericWithHyphens('hello@world')).toBe(false);
            expect(stringIsAlphaNumericWithHyphens('')).toBe(false);
        });
    });
});
