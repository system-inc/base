// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyStringMatches } from './VerifyStringMatches';

describe('VerifyStringMatches', () => {
    describe('with RegExp', () => {
        const pattern = /^[A-Z]{3}-\d{4}$/;

        test('accepts a matching value', () => {
            expect(VerifyStringMatches.check('ABC-1234', pattern)).toBe(true);
        });

        test('rejects a non-matching value', () => {
            expect(VerifyStringMatches.check('abc-1234', pattern)).toBe(false);
        });

        test('rejects a non-string', () => {
            expect(VerifyStringMatches.check(42, pattern)).toBe(false);
        });
    });

    describe('with pattern string', () => {
        test('accepts a matching value', () => {
            expect(VerifyStringMatches.check('hello', '^hello$')).toBe(true);
        });

        test('rejects a non-matching value', () => {
            expect(VerifyStringMatches.check('Hello', '^hello$')).toBe(false);
        });
    });

    describe('with pattern string and modifiers', () => {
        test('accepts case-insensitive match', () => {
            expect(VerifyStringMatches.check('HELLO', '^hello$', 'i')).toBe(
                true,
            );
        });

        test('rejects a non-matching value', () => {
            expect(VerifyStringMatches.check('hi', '^hello$', 'i')).toBe(false);
        });
    });

    describe('stateful flags', () => {
        test('a global-flagged RegExp validates consistently across calls', () => {
            const pattern = /^[a-z]+$/g;
            // With `g` (or `y`) the shared RegExp mutates lastIndex on each
            // .test(), so before the fix repeated calls alternated true/false.
            expect(VerifyStringMatches.check('hello', pattern)).toBe(true);
            expect(VerifyStringMatches.check('hello', pattern)).toBe(true);
            expect(VerifyStringMatches.check('hello', pattern)).toBe(true);
        });

        test('a sticky string modifier validates consistently across calls', () => {
            expect(VerifyStringMatches.check('abc', '^abc$', 'y')).toBe(true);
            expect(VerifyStringMatches.check('abc', '^abc$', 'y')).toBe(true);
        });
    });
});
