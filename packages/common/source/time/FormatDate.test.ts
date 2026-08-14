// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { LANGUAGE_CODE_US } from '../locale/LanguageCode';
import { LocaleOptions } from '../locale/LocaleOptions';
import {
    formatDateLong,
    formatDateMonth,
    formatDateMonthYear,
    formatDateShort,
    formatDateTimestamp,
} from './FormatDate';

describe('FormatDate', () => {
    // Fixed test date for consistent testing across timezones
    const testDate = new Date('2025-01-15T14:30:45.123Z'); // Wednesday, January 15, 2025 at 2:30:45 PM UTC

    describe('formatDateShort', () => {
        it('should format date in short format with default US locale', () => {
            const result = formatDateShort(testDate);
            // Should be in M/D/YYYY format for en-US
            expect(result).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
            expect(result).toContain('2025');
        });

        it('should format date in short format with explicit en-US locale', () => {
            const options: LocaleOptions = { languageCode: LANGUAGE_CODE_US };
            const result = formatDateShort(testDate, options);
            expect(result).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
            expect(result).toContain('2025');
        });

        it('should format date with different language codes', () => {
            const frenchOptions: LocaleOptions = { languageCode: 'fr-FR' };
            const result = formatDateShort(testDate, frenchOptions);
            // French format is typically DD/MM/YYYY
            expect(result).toContain('2025');
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should format date with German locale', () => {
            const germanOptions: LocaleOptions = { languageCode: 'de-DE' };
            const result = formatDateShort(testDate, germanOptions);
            expect(result).toContain('2025');
            expect(typeof result).toBe('string');
        });

        it('should handle timezone option', () => {
            const options: LocaleOptions = {
                languageCode: LANGUAGE_CODE_US,
                timezone: 'America/New_York',
            };
            const result = formatDateShort(testDate, options);
            expect(result).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
            expect(result).toContain('2025');
        });

        it('should handle different timezone formats', () => {
            const utcOptions: LocaleOptions = {
                languageCode: LANGUAGE_CODE_US,
                timezone: 'UTC',
            };
            const pstOptions: LocaleOptions = {
                languageCode: LANGUAGE_CODE_US,
                timezone: 'America/Los_Angeles',
            };

            const utcResult = formatDateShort(testDate, utcOptions);
            const pstResult = formatDateShort(testDate, pstOptions);

            expect(utcResult).toContain('2025');
            expect(pstResult).toContain('2025');
            // Both should be valid dates (might be different due to timezone)
            expect(typeof utcResult).toBe('string');
            expect(typeof pstResult).toBe('string');
        });

        it('should handle edge case dates', () => {
            const newYear = new Date('2025-01-01T12:00:00.000Z'); // Use noon to avoid timezone issues
            const result = formatDateShort(newYear);
            expect(result).toContain('2025');
            expect(result).toContain('1');
        });

        it('should handle leap year dates', () => {
            const leapYearDate = new Date('2024-02-29T12:00:00.000Z');
            const result = formatDateShort(leapYearDate);
            expect(result).toContain('2024');
            expect(result).toContain('29');
        });
    });

    describe('formatDateLong', () => {
        it('should format date in long format with default US locale', () => {
            const result = formatDateLong(testDate);
            // Should contain day name, month name, day, and year
            expect(result).toContain('2025');
            expect(result).toContain('January');
            expect(result).toContain('Wednesday');
            expect(result).toContain('15');
        });

        it('should format date in long format with explicit en-US locale', () => {
            const options: LocaleOptions = { languageCode: LANGUAGE_CODE_US };
            const result = formatDateLong(testDate, options);
            expect(result).toContain('2025');
            expect(result).toContain('January');
            expect(result).toContain('Wednesday');
        });

        it('should format date with French locale', () => {
            const frenchOptions: LocaleOptions = { languageCode: 'fr-FR' };
            const result = formatDateLong(testDate, frenchOptions);
            expect(result).toContain('2025');
            // French month names
            expect(result).toContain('janvier');
            expect(typeof result).toBe('string');
        });

        it('should format date with Spanish locale', () => {
            const spanishOptions: LocaleOptions = { languageCode: 'es-ES' };
            const result = formatDateLong(testDate, spanishOptions);
            expect(result).toContain('2025');
            expect(result).toContain('enero'); // Spanish for January
            expect(typeof result).toBe('string');
        });

        it('should handle timezone in long format', () => {
            const options: LocaleOptions = {
                languageCode: LANGUAGE_CODE_US,
                timezone: 'Europe/London',
            };
            const result = formatDateLong(testDate, options);
            expect(result).toContain('2025');
            expect(typeof result).toBe('string');
        });

        it('should handle different weekdays', () => {
            const monday = new Date('2025-01-13T12:00:00.000Z'); // Monday
            const friday = new Date('2025-01-17T12:00:00.000Z'); // Friday

            const mondayResult = formatDateLong(monday);
            const fridayResult = formatDateLong(friday);

            expect(mondayResult).toContain('Monday');
            expect(fridayResult).toContain('Friday');
        });
    });

    describe('formatDateMonth', () => {
        it('should format date showing only month and year with default locale', () => {
            const result = formatDateMonth(testDate);
            expect(result).toContain('January');
            expect(result).toContain('2025');
            expect(result).not.toContain('15'); // Should not include day
            expect(result).not.toContain('Wednesday'); // Should not include weekday
        });

        it('should format month with explicit en-US locale', () => {
            const options: LocaleOptions = { languageCode: LANGUAGE_CODE_US };
            const result = formatDateMonth(testDate, options);
            expect(result).toContain('January');
            expect(result).toContain('2025');
        });

        it('should format month with different locales', () => {
            const frenchOptions: LocaleOptions = { languageCode: 'fr-FR' };
            const germanOptions: LocaleOptions = { languageCode: 'de-DE' };

            const frenchResult = formatDateMonth(testDate, frenchOptions);
            const germanResult = formatDateMonth(testDate, germanOptions);

            expect(frenchResult).toContain('janvier');
            expect(frenchResult).toContain('2025');
            expect(germanResult).toContain('Januar');
            expect(germanResult).toContain('2025');
        });

        it('should handle timezone for month formatting', () => {
            const options: LocaleOptions = {
                languageCode: LANGUAGE_CODE_US,
                timezone: 'Asia/Tokyo',
            };
            const result = formatDateMonth(testDate, options);
            expect(result).toContain('2025');
            expect(typeof result).toBe('string');
        });

        it('should handle different months', () => {
            const december = new Date('2024-12-25T12:00:00.000Z');
            const june = new Date('2025-06-15T12:00:00.000Z');

            const decResult = formatDateMonth(december);
            const juneResult = formatDateMonth(june);

            expect(decResult).toContain('December');
            expect(decResult).toContain('2024');
            expect(juneResult).toContain('June');
            expect(juneResult).toContain('2025');
        });
    });

    describe('formatDateTimestamp', () => {
        it('should format complete timestamp with default US locale', () => {
            const result = formatDateTimestamp(testDate);
            expect(result).toContain('2025');
            expect(result).toContain('January');
            expect(result).toContain('Wednesday');
            expect(result).toContain('15');
            // Should contain time information
            expect(result).toMatch(/\d{1,2}:\d{2}/); // Hour:Minute format
        });

        it('should format timestamp with explicit en-US locale', () => {
            const options: LocaleOptions = { languageCode: LANGUAGE_CODE_US };
            const result = formatDateTimestamp(testDate, options);
            expect(result).toContain('2025');
            expect(result).toContain('January');
            expect(result).toMatch(/\d{1,2}:\d{2}/);
        });

        it('should format timestamp with different locales', () => {
            const frenchOptions: LocaleOptions = { languageCode: 'fr-FR' };
            const result = formatDateTimestamp(testDate, frenchOptions);
            expect(result).toContain('2025');
            expect(result).toContain('janvier');
            expect(typeof result).toBe('string');
        });

        it('should include timezone information in timestamp', () => {
            const options: LocaleOptions = {
                languageCode: LANGUAGE_CODE_US,
                timezone: 'America/New_York',
            };
            const result = formatDateTimestamp(testDate, options);
            expect(result).toContain('2025');
            // Should contain timezone abbreviation
            expect(result).toMatch(/[A-Z]{3,4}/); // Timezone abbreviation like EST, EDT, UTC
        });

        it('should handle different timezones correctly', () => {
            const utcOptions: LocaleOptions = {
                languageCode: LANGUAGE_CODE_US,
                timezone: 'UTC',
            };
            const jstOptions: LocaleOptions = {
                languageCode: LANGUAGE_CODE_US,
                timezone: 'Asia/Tokyo',
            };

            const utcResult = formatDateTimestamp(testDate, utcOptions);
            const jstResult = formatDateTimestamp(testDate, jstOptions);

            expect(utcResult).toContain('UTC');
            expect(jstResult).toMatch(/JST|GMT\+9/);
            expect(utcResult).toContain('2025');
            expect(jstResult).toContain('2025');
        });

        it('should handle midnight and noon times', () => {
            const midnight = new Date('2025-01-15T00:00:00.000Z');
            const noon = new Date('2025-01-15T12:00:00.000Z');

            const midnightResult = formatDateTimestamp(midnight);
            const noonResult = formatDateTimestamp(noon);

            expect(midnightResult).toContain('2025');
            expect(noonResult).toContain('2025');
            expect(typeof midnightResult).toBe('string');
            expect(typeof noonResult).toBe('string');
        });
    });

    describe('formatDateMonthYear', () => {
        it('should format date in MM/YY format with default locale', () => {
            const result = formatDateMonthYear(testDate);
            // Should be in MM/YY format (2-digit month, 2-digit year)
            expect(result).toMatch(/^\d{2}\/\d{2}$/);
            expect(result).toBe('01/25'); // January 2025 -> 01/25
        });

        it('should format month/year with explicit en-US locale', () => {
            const options: LocaleOptions = { languageCode: LANGUAGE_CODE_US };
            const result = formatDateMonthYear(testDate, options);
            expect(result).toBe('01/25');
        });

        it('should format month/year with different locales', () => {
            const frenchOptions: LocaleOptions = { languageCode: 'fr-FR' };
            const result = formatDateMonthYear(testDate, frenchOptions);
            // French format might be different but should still contain month/year info
            expect(result).toMatch(/\d{2}/);
            expect(typeof result).toBe('string');
        });

        it('should handle different months correctly', () => {
            const december = new Date('2024-12-01T12:00:00.000Z');
            const march = new Date('2025-03-01T12:00:00.000Z');
            const november = new Date('2025-11-01T12:00:00.000Z');

            const decResult = formatDateMonthYear(december);
            const marResult = formatDateMonthYear(march);
            const novResult = formatDateMonthYear(november);

            expect(decResult).toBe('12/24');
            expect(marResult).toBe('03/25');
            expect(novResult).toBe('11/25');
        });

        it('should handle timezone for month/year formatting', () => {
            const options: LocaleOptions = {
                languageCode: LANGUAGE_CODE_US,
                timezone: 'Pacific/Auckland',
            };
            const result = formatDateMonthYear(testDate, options);
            expect(result).toMatch(/^\d{2}\/\d{2}$/);
            expect(typeof result).toBe('string');
        });

        it('should handle year boundaries', () => {
            const newYear = new Date('2025-01-01T12:00:00.000Z'); // Use noon to avoid timezone issues
            const endYear = new Date('2025-12-31T12:00:00.000Z'); // Use noon to avoid timezone issues

            const newYearResult = formatDateMonthYear(newYear);
            const endYearResult = formatDateMonthYear(endYear);

            expect(newYearResult).toBe('01/25');
            expect(endYearResult).toBe('12/25');
        });
    });

    describe('edge cases and error scenarios', () => {
        it('should handle invalid date objects gracefully', () => {
            const invalidDate = new Date('invalid-date');

            // All functions should handle invalid dates without throwing
            expect(() => formatDateShort(invalidDate)).not.toThrow();
            expect(() => formatDateLong(invalidDate)).not.toThrow();
            expect(() => formatDateMonth(invalidDate)).not.toThrow();
            expect(() => formatDateTimestamp(invalidDate)).not.toThrow();
            expect(() => formatDateMonthYear(invalidDate)).not.toThrow();
        });

        it('should handle very old dates', () => {
            const oldDate = new Date('1900-01-01T12:00:00.000Z'); // Use noon to avoid timezone issues

            const shortResult = formatDateShort(oldDate);
            const longResult = formatDateLong(oldDate);

            expect(shortResult).toContain('1900');
            expect(longResult).toContain('1900');
        });

        it('should handle very future dates', () => {
            const futureDate = new Date('2099-12-31T12:00:00.999Z'); // Use noon to avoid timezone issues

            const shortResult = formatDateShort(futureDate);
            const monthResult = formatDateMonth(futureDate);

            expect(shortResult).toContain('2099');
            expect(monthResult).toContain('2099');
        });

        it('should handle Date object created from timestamp', () => {
            const timestamp = 1673779845123; // January 15, 2023
            const dateFromTimestamp = new Date(timestamp);

            const result = formatDateShort(dateFromTimestamp);
            expect(result).toContain('2023');
            expect(typeof result).toBe('string');
        });

        it('should handle empty LocaleOptions object', () => {
            const emptyOptions: LocaleOptions = {};

            const result = formatDateShort(testDate, emptyOptions);
            expect(result).toContain('2025');
            expect(typeof result).toBe('string');
        });

        it('should handle undefined options gracefully', () => {
            const result = formatDateLong(testDate, undefined);
            expect(result).toContain('2025');
            expect(result).toContain('January');
        });

        it('should handle invalid timezone strings', () => {
            const invalidTimezoneOptions: LocaleOptions = {
                languageCode: LANGUAGE_CODE_US,
                timezone: 'Invalid/Timezone',
            };

            // Should throw RangeError for invalid timezone
            expect(() =>
                formatDateTimestamp(testDate, invalidTimezoneOptions),
            ).toThrow(RangeError);
        });

        it('should handle invalid language codes', () => {
            const invalidLanguageOptions: LocaleOptions = {
                languageCode: 'invalid-locale',
            };

            // Should not throw but may fall back to default locale
            expect(() =>
                formatDateLong(testDate, invalidLanguageOptions),
            ).not.toThrow();
        });
    });

    describe('consistency and behavior', () => {
        it('should return consistent results for same input', () => {
            const result1 = formatDateShort(testDate);
            const result2 = formatDateShort(testDate);

            expect(result1).toBe(result2);
        });

        it('should create new Date object internally (not mutate input)', () => {
            const originalDate = new Date('2025-01-15T14:30:45.123Z');
            const originalTime = originalDate.getTime();

            formatDateLong(originalDate);

            // Original date should not be modified
            expect(originalDate.getTime()).toBe(originalTime);
        });

        it('should handle DST transitions correctly', () => {
            // Date during DST transition
            const springForward = new Date('2025-03-09T08:00:00.000Z'); // US DST starts
            const fallBack = new Date('2025-11-02T08:00:00.000Z'); // US DST ends

            const springOptions: LocaleOptions = {
                languageCode: LANGUAGE_CODE_US,
                timezone: 'America/New_York',
            };

            const springResult = formatDateTimestamp(
                springForward,
                springOptions,
            );
            const fallResult = formatDateTimestamp(fallBack, springOptions);

            expect(springResult).toContain('2025');
            expect(fallResult).toContain('2025');
            expect(typeof springResult).toBe('string');
            expect(typeof fallResult).toBe('string');
        });

        it('should handle same date in different timezones', () => {
            const utcOptions: LocaleOptions = {
                languageCode: LANGUAGE_CODE_US,
                timezone: 'UTC',
            };
            const sydneyOptions: LocaleOptions = {
                languageCode: LANGUAGE_CODE_US,
                timezone: 'Australia/Sydney',
            };

            const utcShort = formatDateShort(testDate, utcOptions);
            const sydneyShort = formatDateShort(testDate, sydneyOptions);

            // Both should be valid dates, might be different due to timezone offset
            expect(utcShort).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
            expect(sydneyShort).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
        });
    });
});
