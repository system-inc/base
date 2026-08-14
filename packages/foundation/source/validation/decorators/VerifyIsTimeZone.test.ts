// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyIsTimeZone } from './VerifyIsTimeZone';

describe('VerifyIsTimeZone', () => {
    test('accepts IANA zone (America/New_York)', () => {
        expect(VerifyIsTimeZone.check('America/New_York')).toBe(true);
    });

    test('accepts UTC', () => {
        expect(VerifyIsTimeZone.check('UTC')).toBe(true);
    });

    test('accepts Europe/London', () => {
        expect(VerifyIsTimeZone.check('Europe/London')).toBe(true);
    });

    test('rejects an unknown zone', () => {
        expect(VerifyIsTimeZone.check('Not/A_Real_Zone')).toBe(false);
    });

    test('rejects an empty string', () => {
        expect(VerifyIsTimeZone.check('')).toBe(false);
    });

    test('rejects a non-string', () => {
        expect(VerifyIsTimeZone.check(42)).toBe(false);
    });
});
