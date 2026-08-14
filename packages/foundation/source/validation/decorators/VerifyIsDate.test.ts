// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { VerifyIsDate } from './VerifyIsDate';

describe('VerifyIsDate', () => {
    test('accepts a valid Date', () => {
        expect(VerifyIsDate.check(new Date('2024-01-15T00:00:00Z'))).toBe(true);
    });

    test('accepts the epoch', () => {
        expect(VerifyIsDate.check(new Date(0))).toBe(true);
    });

    test('rejects an invalid Date', () => {
        expect(VerifyIsDate.check(new Date('not a date'))).toBe(false);
    });

    test('rejects a date string', () => {
        expect(VerifyIsDate.check('2024-01-15')).toBe(false);
    });

    test('rejects a timestamp number', () => {
        expect(VerifyIsDate.check(Date.now())).toBe(false);
    });
});
