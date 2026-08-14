// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyMaxDate } from './VerifyMaxDate';

describe('VerifyMaxDate', () => {
    const maximum = new Date('2024-12-31T23:59:59Z');

    test('accepts a date before the maximum', () => {
        expect(
            VerifyMaxDate.check(new Date('2024-06-01T00:00:00Z'), maximum),
        ).toBe(true);
    });

    test('accepts a date equal to the maximum', () => {
        expect(
            VerifyMaxDate.check(new Date('2024-12-31T23:59:59Z'), maximum),
        ).toBe(true);
    });

    test('rejects a date after the maximum', () => {
        expect(
            VerifyMaxDate.check(new Date('2025-06-01T00:00:00Z'), maximum),
        ).toBe(false);
    });

    test('rejects a non-Date value (string)', () => {
        expect(VerifyMaxDate.check('2024-06-01', maximum)).toBe(false);
    });

    test('rejects a non-Date value (number)', () => {
        expect(VerifyMaxDate.check(Date.now(), maximum)).toBe(false);
    });
});
