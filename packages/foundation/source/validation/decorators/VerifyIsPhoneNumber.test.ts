// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    IsPhoneNumberOptions,
    verifyIsPhoneNumber,
} from './VerifyIsPhoneNumber';

describe('verifyIsPhoneNumber', () => {
    describe('basic validation', () => {
        test('returns false for null, undefined, and empty string', () => {
            expect(verifyIsPhoneNumber(null)).toBe(false);
            expect(verifyIsPhoneNumber(undefined)).toBe(false);
            expect(verifyIsPhoneNumber('')).toBe(false);
        });

        test('returns false for non-string and non-number types', () => {
            expect(verifyIsPhoneNumber({})).toBe(false);
            expect(verifyIsPhoneNumber([])).toBe(false);
            expect(verifyIsPhoneNumber(true)).toBe(false);
        });

        test('accepts string and number inputs', () => {
            expect(verifyIsPhoneNumber('+12125551234')).toBe(true);
            expect(verifyIsPhoneNumber(12125551234)).toBe(true);
        });
    });

    describe('E.164 format validation', () => {
        test('validates correct E.164 numbers', () => {
            const options: IsPhoneNumberOptions = { region: 'e164' };

            expect(verifyIsPhoneNumber('+12125551234', options)).toBe(true);
            expect(verifyIsPhoneNumber('+441234567890', options)).toBe(true);
            expect(verifyIsPhoneNumber('+8613812345678', options)).toBe(true);
        });

        test('rejects invalid E.164 numbers', () => {
            const options: IsPhoneNumberOptions = { region: 'e164' };

            // Missing +
            expect(verifyIsPhoneNumber('12125551234', options)).toBe(false);
            // Too short
            expect(verifyIsPhoneNumber('+1234567', options)).toBe(false);
            // Too long
            expect(verifyIsPhoneNumber('+1234567890123456', options)).toBe(
                false,
            );
            // Starts with 0 after +
            expect(verifyIsPhoneNumber('+01234567890', options)).toBe(false);
            // Contains non-digits
            expect(verifyIsPhoneNumber('+1-212-555-1234', options)).toBe(false);
        });
    });

    describe('NANP format validation', () => {
        test('validates correct NANP numbers', () => {
            const options: IsPhoneNumberOptions = { region: 'nanp' };

            expect(verifyIsPhoneNumber('2125551234', options)).toBe(true);
            expect(verifyIsPhoneNumber('(212) 555-1234', options)).toBe(true);
            expect(verifyIsPhoneNumber('212-555-1234', options)).toBe(true);
            expect(verifyIsPhoneNumber('212.555.1234', options)).toBe(true);
            expect(verifyIsPhoneNumber('12125551234', options)).toBe(true); // With country code
        });

        test('rejects invalid NANP numbers', () => {
            const options: IsPhoneNumberOptions = { region: 'nanp' };

            // Area code starts with 0 or 1
            expect(verifyIsPhoneNumber('0125551234', options)).toBe(false);
            expect(verifyIsPhoneNumber('1125551234', options)).toBe(false);
            // Exchange starts with 0 or 1
            expect(verifyIsPhoneNumber('2100551234', options)).toBe(false);
            expect(verifyIsPhoneNumber('2110551234', options)).toBe(false);
            // All same digits
            expect(verifyIsPhoneNumber('2222222222', options)).toBe(false);
            // Wrong length
            expect(verifyIsPhoneNumber('212555123', options)).toBe(false);
            expect(verifyIsPhoneNumber('21255512345', options)).toBe(false);
        });
    });

    describe('international format validation', () => {
        test('validates correct international numbers', () => {
            const options: IsPhoneNumberOptions = { region: 'international' };

            expect(verifyIsPhoneNumber('+12125551234', options)).toBe(true);
            expect(verifyIsPhoneNumber('12125551234', options)).toBe(true);
            expect(verifyIsPhoneNumber('441234567890', options)).toBe(true);
            expect(verifyIsPhoneNumber('8613812345678', options)).toBe(true);
        });

        test('rejects invalid international numbers', () => {
            const options: IsPhoneNumberOptions = { region: 'international' };

            // Too short
            expect(verifyIsPhoneNumber('1234567', options)).toBe(false);
            // Too long
            expect(verifyIsPhoneNumber('1234567890123456', options)).toBe(
                false,
            );
            // All same digits
            expect(verifyIsPhoneNumber('7777777777', options)).toBe(false);
            // Invalid E.164 with +
            expect(verifyIsPhoneNumber('+01234567890', options)).toBe(false);
        });
    });

    describe('multiple regions support', () => {
        test('validates against multiple regions', () => {
            const options: IsPhoneNumberOptions = { region: ['e164', 'nanp'] };

            expect(verifyIsPhoneNumber('+12125551234', options)).toBe(true); // E.164
            expect(verifyIsPhoneNumber('(212) 555-1234', options)).toBe(true); // NANP
        });

        test('fails if none of the regions match', () => {
            const options: IsPhoneNumberOptions = { region: ['e164'] };

            expect(verifyIsPhoneNumber('(212) 555-1234', options)).toBe(false); // NANP format but only E.164 allowed
        });
    });

    describe('extensions handling', () => {
        test('allows extensions by default', () => {
            expect(verifyIsPhoneNumber('+12125551234 ext 123')).toBe(true);
            expect(verifyIsPhoneNumber('+12125551234 x123')).toBe(true);
            expect(verifyIsPhoneNumber('+12125551234#123')).toBe(true);
            expect(verifyIsPhoneNumber('(212) 555-1234 ext. 123')).toBe(true);
        });

        test('rejects extensions when disabled', () => {
            const options: IsPhoneNumberOptions = { allowExtensions: false };

            expect(verifyIsPhoneNumber('+12125551234 ext 123', options)).toBe(
                false,
            );
            expect(verifyIsPhoneNumber('+12125551234 x123', options)).toBe(
                false,
            );
            expect(verifyIsPhoneNumber('+12125551234#123', options)).toBe(
                false,
            );
        });

        test('validates base number after stripping extensions', () => {
            const options: IsPhoneNumberOptions = { region: 'e164' };

            expect(verifyIsPhoneNumber('+12125551234 ext 123', options)).toBe(
                true,
            );
            expect(verifyIsPhoneNumber('12125551234 ext 123', options)).toBe(
                false,
            ); // Missing + for E.164
        });
    });

    describe('default options behavior', () => {
        test('uses e164 and nanp regions by default', () => {
            expect(verifyIsPhoneNumber('+12125551234')).toBe(true); // E.164
            expect(verifyIsPhoneNumber('(212) 555-1234')).toBe(true); // NANP
            expect(verifyIsPhoneNumber('441234567890')).toBe(false); // International without +
        });

        test('allows extensions by default', () => {
            expect(verifyIsPhoneNumber('+12125551234 ext 123')).toBe(true);
        });
    });

    describe('edge cases', () => {
        test('handles whitespace properly', () => {
            expect(verifyIsPhoneNumber('  +12125551234  ')).toBe(true);
            expect(verifyIsPhoneNumber('  (212) 555-1234  ')).toBe(true);
        });

        test('handles number input type', () => {
            expect(verifyIsPhoneNumber(12125551234)).toBe(true);
        });

        test('handles various formatting characters in NANP', () => {
            const options: IsPhoneNumberOptions = { region: 'nanp' };

            expect(verifyIsPhoneNumber('212 555 1234', options)).toBe(true);
            expect(verifyIsPhoneNumber('212/555/1234', options)).toBe(true);
            expect(verifyIsPhoneNumber('(212)555-1234', options)).toBe(true);
        });
    });
});
