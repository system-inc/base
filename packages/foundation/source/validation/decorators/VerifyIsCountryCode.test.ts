// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    ISO_3166_1_ALPHA2,
    ISO_3166_1_ALPHA3,
    ISO_3166_1_NUMERIC,
} from './internal/Iso3166Codes';
import { VerifyIsCountryCode } from './VerifyIsCountryCode';

describe('VerifyIsCountryCode', () => {
    describe('data integrity', () => {
        // The three lists must stay in sync — every country should
        // have an alpha2, an alpha3, and a numeric code.
        test('all three lists have the same size', () => {
            expect(ISO_3166_1_ALPHA2.size).toBe(ISO_3166_1_ALPHA3.size);
            expect(ISO_3166_1_ALPHA3.size).toBe(ISO_3166_1_NUMERIC.size);
        });

        test('list size matches the known ISO 3166-1 count', () => {
            // 249 entries as of ISO 3166-1 current revision. Update
            // here if the authoritative list changes.
            expect(ISO_3166_1_ALPHA2.size).toBe(249);
        });
    });

    describe('default (alpha2)', () => {
        test.each(['US', 'DE', 'GB', 'JP', 'FR', 'BR', 'CN', 'AD', 'ZW'])(
            'accepts real code %s',
            (code) => {
                expect(VerifyIsCountryCode.check(code)).toBe(true);
            },
        );

        test.each([
            'XX', // unassigned
            'ZZ', // user-assigned, not ISO
            'AA', // not ISO
            'us', // lowercase
            'USA', // alpha3 shape, not alpha2
            'U', // too short
            'USAS', // too long
            '',
        ])('rejects invalid %s', (code) => {
            expect(VerifyIsCountryCode.check(code)).toBe(false);
        });

        test('rejects a non-string', () => {
            expect(VerifyIsCountryCode.check(42)).toBe(false);
        });
    });

    describe('alpha3', () => {
        test.each(['USA', 'DEU', 'GBR', 'JPN', 'FRA', 'BRA', 'CHN'])(
            'accepts real code %s',
            (code) => {
                expect(VerifyIsCountryCode.check(code, 'alpha3')).toBe(true);
            },
        );

        test('rejects a valid alpha2 in alpha3 mode', () => {
            expect(VerifyIsCountryCode.check('US', 'alpha3')).toBe(false);
        });

        test('rejects lowercase', () => {
            expect(VerifyIsCountryCode.check('usa', 'alpha3')).toBe(false);
        });

        test('rejects a fake 3-letter code', () => {
            expect(VerifyIsCountryCode.check('XXX', 'alpha3')).toBe(false);
        });
    });

    describe('numeric', () => {
        test.each([
            '840', // US
            '276', // DE
            '826', // GB
            '392', // JP
            '250', // FR
            '076', // BR (note zero-padding)
            '156', // CN
        ])('accepts real code %s', (code) => {
            expect(VerifyIsCountryCode.check(code, 'numeric')).toBe(true);
        });

        test('rejects a non-existent numeric code', () => {
            expect(VerifyIsCountryCode.check('999', 'numeric')).toBe(false);
        });

        test('rejects the number form (must be string)', () => {
            expect(VerifyIsCountryCode.check(840, 'numeric')).toBe(false);
        });

        test('rejects unpadded form', () => {
            // Brazil is "076", not "76".
            expect(VerifyIsCountryCode.check('76', 'numeric')).toBe(false);
        });

        test('rejects letters in numeric mode', () => {
            expect(VerifyIsCountryCode.check('USA', 'numeric')).toBe(false);
        });
    });
});
