// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyIsDomain } from './VerifyIsDomain';

describe('VerifyIsDomain', () => {
    test('accepts a simple two-label domain', () => {
        expect(VerifyIsDomain.check('example.com')).toBe(true);
    });

    test('accepts a multi-label domain', () => {
        expect(VerifyIsDomain.check('a.b.example.co.uk')).toBe(true);
    });

    test('rejects a single-label hostname', () => {
        expect(VerifyIsDomain.check('localhost')).toBe(false);
    });

    test('rejects trailing dot', () => {
        expect(VerifyIsDomain.check('example.com.')).toBe(false);
    });

    test('rejects a label starting with hyphen', () => {
        expect(VerifyIsDomain.check('-example.com')).toBe(false);
    });

    test('rejects a numeric TLD', () => {
        expect(VerifyIsDomain.check('example.123')).toBe(false);
    });

    test('rejects an empty string', () => {
        expect(VerifyIsDomain.check('')).toBe(false);
    });

    test('rejects a non-string', () => {
        expect(VerifyIsDomain.check(42)).toBe(false);
    });
});
