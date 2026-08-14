// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    stringCamelToKebab,
    stringLowercaseFirstLetter,
    stringToCapsAndUnderscores,
    stringToTitleCase,
} from './CaseConversion';

describe('CaseConversion', () => {
    describe('stringLowercaseFirstLetter', () => {
        test('should lowercase the first letter of a string', () => {
            expect(stringLowercaseFirstLetter('Hello')).toBe('hello');
            expect(stringLowercaseFirstLetter('WORLD')).toBe('wORLD');
            expect(stringLowercaseFirstLetter('JavaScript')).toBe('javaScript');
        });

        test('should handle empty string', () => {
            expect(stringLowercaseFirstLetter('')).toBe('');
        });

        test('should handle single character strings', () => {
            expect(stringLowercaseFirstLetter('A')).toBe('a');
            expect(stringLowercaseFirstLetter('z')).toBe('z');
        });

        test('should handle strings with numbers and special characters', () => {
            expect(stringLowercaseFirstLetter('123abc')).toBe('123abc');
            expect(stringLowercaseFirstLetter('!Hello')).toBe('!Hello');
        });
    });

    describe('stringToTitleCase', () => {
        test('should convert strings to title case', () => {
            expect(stringToTitleCase('hello world')).toBe('Hello World');
            expect(stringToTitleCase('the quick brown fox')).toBe(
                'The Quick Brown Fox',
            );
            expect(stringToTitleCase('UPPERCASE STRING')).toBe(
                'UPPERCASE STRING',
            );
        });

        test('should handle single words', () => {
            expect(stringToTitleCase('hello')).toBe('Hello');
            expect(stringToTitleCase('WORLD')).toBe('WORLD');
        });

        test('should handle empty string and edge cases', () => {
            expect(stringToTitleCase('')).toBe('');
            expect(stringToTitleCase('a')).toBe('A');
            expect(stringToTitleCase('a b')).toBe('A B');
        });

        test('should handle multiple spaces', () => {
            expect(stringToTitleCase('hello  world')).toBe('Hello  World');
            expect(stringToTitleCase('  leading spaces')).toBe(
                '  Leading Spaces',
            );
        });
    });

    describe('stringCamelToKebab', () => {
        test('should convert camelCase to kebab-case', () => {
            expect(stringCamelToKebab('camelCase')).toBe('camel-case');
            expect(stringCamelToKebab('thisIsALongName')).toBe(
                'this-is-a-long-name',
            );
            expect(stringCamelToKebab('HTMLElement')).toBe('h-t-m-l-element');
        });

        test('should handle single words', () => {
            expect(stringCamelToKebab('hello')).toBe('hello');
            expect(stringCamelToKebab('HELLO')).toBe('h-e-l-l-o');
        });

        test('should handle empty string', () => {
            expect(stringCamelToKebab('')).toBe('');
        });

        test('should handle strings starting with uppercase', () => {
            expect(stringCamelToKebab('CamelCase')).toBe('camel-case');
        });
    });

    describe('stringToCapsAndUnderscores', () => {
        test('should convert camelCase to CAPS_AND_UNDERSCORES', () => {
            expect(stringToCapsAndUnderscores('camelCase')).toBe('CAMEL_CASE');
            expect(stringToCapsAndUnderscores('thisIsALongName')).toBe(
                'THIS_IS_ALONG_NAME',
            );
        });

        test('should convert space-separated strings', () => {
            expect(stringToCapsAndUnderscores('hello world')).toBe(
                'HELLO_WORLD',
            );
            expect(stringToCapsAndUnderscores('the quick brown fox')).toBe(
                'THE_QUICK_BROWN_FOX',
            );
        });

        test('should convert hyphen-separated strings', () => {
            expect(stringToCapsAndUnderscores('hello-world')).toBe(
                'HELLO_WORLD',
            );
            expect(stringToCapsAndUnderscores('kebab-case-string')).toBe(
                'KEBAB_CASE_STRING',
            );
        });

        test('should handle mixed formats', () => {
            expect(stringToCapsAndUnderscores('camelCase with spaces')).toBe(
                'CAMEL_CASE_WITH_SPACES',
            );
            expect(
                stringToCapsAndUnderscores('mixedFormat-withHyphens andSpaces'),
            ).toBe('MIXED_FORMAT_WITH_HYPHENS_AND_SPACES');
        });

        test('should handle empty string', () => {
            expect(stringToCapsAndUnderscores('')).toBe('');
        });

        test('should handle single words', () => {
            expect(stringToCapsAndUnderscores('hello')).toBe('HELLO');
        });
    });
});
