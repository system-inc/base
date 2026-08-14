// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyIsEmail } from './VerifyIsEmail';

describe('VerifyIsEmail', () => {
    test('accepts a simple email', () => {
        expect(VerifyIsEmail.check('user@example.com')).toBe(true);
    });

    test('accepts an email with subdomain and plus-tag', () => {
        expect(VerifyIsEmail.check('a.b+tag@mail.example.co.uk')).toBe(true);
    });

    test('rejects a string without an @', () => {
        expect(VerifyIsEmail.check('abc')).toBe(false);
    });

    test('rejects a string without a TLD', () => {
        expect(VerifyIsEmail.check('user@host')).toBe(false);
    });

    test('rejects whitespace in the address', () => {
        expect(VerifyIsEmail.check('user name@example.com')).toBe(false);
    });

    test('rejects an empty string', () => {
        expect(VerifyIsEmail.check('')).toBe(false);
    });

    test('rejects a non-string', () => {
        expect(VerifyIsEmail.check(42)).toBe(false);
    });
});
