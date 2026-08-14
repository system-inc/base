// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyMinDate } from './VerifyMinDate';

describe('VerifyMinDate', () => {
    const minimum = new Date('2024-01-01T00:00:00Z');

    test('accepts a date after the minimum', () => {
        expect(
            VerifyMinDate.check(new Date('2025-01-01T00:00:00Z'), minimum),
        ).toBe(true);
    });

    test('accepts a date equal to the minimum', () => {
        expect(
            VerifyMinDate.check(new Date('2024-01-01T00:00:00Z'), minimum),
        ).toBe(true);
    });

    test('rejects a date before the minimum', () => {
        expect(
            VerifyMinDate.check(new Date('2023-01-01T00:00:00Z'), minimum),
        ).toBe(false);
    });

    test('rejects a non-Date value (string)', () => {
        expect(VerifyMinDate.check('2025-01-01', minimum)).toBe(false);
    });

    test('rejects a non-Date value (number)', () => {
        expect(VerifyMinDate.check(Date.now(), minimum)).toBe(false);
    });
});
