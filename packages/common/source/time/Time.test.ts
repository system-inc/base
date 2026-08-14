// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    DateInterval,
    dateToISOStringWithTimezone,
    dateToUnixTime,
    dateWithInterval,
    MILLISECONDS_PER_DAY,
    MILLISECONDS_PER_HOUR,
    MILLISECONDS_PER_MINUTE,
    MILLISECONDS_PER_SECOND,
    millisecondsToDayDisplay,
    millsecondsToMinutes,
    unixTimeToDate,
} from './Time';

describe('Time', () => {
    describe('Constants', () => {
        test('should have correct time constants', () => {
            expect(MILLISECONDS_PER_SECOND).toBe(1000);
            expect(MILLISECONDS_PER_MINUTE).toBe(60 * 1000);
            expect(MILLISECONDS_PER_HOUR).toBe(60 * 60 * 1000);
            expect(MILLISECONDS_PER_DAY).toBe(24 * 60 * 60 * 1000);
        });
    });

    describe('dateToUnixTime', () => {
        test('should convert Date to Unix timestamp', () => {
            const date = new Date('2023-01-01T00:00:00.000Z');
            const unixTime = dateToUnixTime(date);
            expect(unixTime).toBe(1672531200); // Unix timestamp for 2023-01-01T00:00:00.000Z
        });

        test('should handle dates with milliseconds correctly', () => {
            const date = new Date('2023-01-01T00:00:00.500Z');
            const unixTime = dateToUnixTime(date);
            expect(unixTime).toBe(1672531200); // Should floor the milliseconds
        });

        test('should handle different dates', () => {
            const date1 = new Date('1970-01-01T00:00:00.000Z');
            const date2 = new Date('2000-01-01T00:00:00.000Z');

            expect(dateToUnixTime(date1)).toBe(0);
            expect(dateToUnixTime(date2)).toBe(946684800);
        });
    });

    describe('unixTimeToDate', () => {
        test('should convert Unix timestamp to Date', () => {
            const unixTime = 1672531200; // 2023-01-01T00:00:00.000Z
            const date = unixTimeToDate(unixTime);
            expect(date).toEqual(new Date('2023-01-01T00:00:00.000Z'));
        });

        test('should return null for null input', () => {
            expect(unixTimeToDate(null)).toBeNull();
        });

        test('should return null for undefined input', () => {
            expect(unixTimeToDate(undefined)).toBeNull();
        });

        test('should return null for zero', () => {
            expect(unixTimeToDate(0)).toBeNull();
        });

        test('should handle negative Unix timestamps', () => {
            const unixTime = -86400; // One day before epoch
            const date = unixTimeToDate(unixTime);
            expect(date).toEqual(new Date('1969-12-31T00:00:00.000Z'));
        });

        test('should handle large Unix timestamps', () => {
            const unixTime = 2147483647; // Max 32-bit signed integer
            const date = unixTimeToDate(unixTime);
            expect(date).toEqual(new Date('2038-01-19T03:14:07.000Z'));
        });
    });

    describe('DateInterval enum', () => {
        test('should have correct enum values', () => {
            expect(DateInterval.Second).toBe('Second');
            expect(DateInterval.Minute).toBe('Minute');
            expect(DateInterval.Hour).toBe('Hour');
            expect(DateInterval.Day).toBe('Day');
            expect(DateInterval.Week).toBe('Week');
            expect(DateInterval.Month).toBe('Month');
            expect(DateInterval.Year).toBe('Year');
        });
    });

    describe('dateWithInterval', () => {
        const baseDate = new Date('2023-06-15T12:30:45.123Z');

        test.each([
            DateInterval.Second,
            DateInterval.Minute,
            DateInterval.Hour,
            DateInterval.Day,
            DateInterval.Week,
            DateInterval.Month,
            DateInterval.Quarter,
            DateInterval.Year,
        ])('does not mutate the input date for %s', (interval) => {
            const input = new Date('2023-01-15T00:00:00.000Z');
            const before = input.getTime();
            const result = dateWithInterval(interval, 1, input);
            expect(input.getTime()).toBe(before);
            // the returned date is a distinct, advanced instant
            expect(result.getTime()).toBeGreaterThan(before);
            expect(result).not.toBe(input);
        });

        test('should add seconds correctly', () => {
            const result = dateWithInterval(DateInterval.Second, 30, baseDate);
            expect(result.getTime()).toBe(
                baseDate.getTime() + 30 * MILLISECONDS_PER_SECOND,
            );
        });

        test('should add minutes correctly', () => {
            const result = dateWithInterval(DateInterval.Minute, 15, baseDate);
            expect(result.getTime()).toBe(
                baseDate.getTime() + 15 * MILLISECONDS_PER_MINUTE,
            );
        });

        test('should add hours correctly', () => {
            const result = dateWithInterval(DateInterval.Hour, 3, baseDate);
            expect(result.getTime()).toBe(
                baseDate.getTime() + 3 * MILLISECONDS_PER_HOUR,
            );
        });

        test('should add days correctly', () => {
            const result = dateWithInterval(DateInterval.Day, 7, baseDate);
            expect(result.getTime()).toBe(
                baseDate.getTime() + 7 * MILLISECONDS_PER_DAY,
            );
        });

        test('should add weeks correctly', () => {
            const result = dateWithInterval(DateInterval.Week, 2, baseDate);
            expect(result.getTime()).toBe(
                baseDate.getTime() + 2 * 7 * MILLISECONDS_PER_DAY,
            );
        });

        test('should add months correctly', () => {
            const testDate = new Date('2023-01-15T12:00:00.000Z');
            const result = dateWithInterval(DateInterval.Month, 2, testDate);
            expect(result.getMonth()).toBe(2); // March (0-indexed)
            expect(result.getFullYear()).toBe(2023);
        });

        test('should handle month overflow to next year', () => {
            const testDate = new Date('2023-11-15T12:00:00.000Z');
            const result = dateWithInterval(DateInterval.Month, 3, testDate);
            expect(result.getMonth()).toBe(1); // February (0-indexed)
            expect(result.getFullYear()).toBe(2024);
        });

        test('should add years correctly', () => {
            const testDate = new Date('2020-02-29T12:00:00.000Z'); // Leap year
            const result = dateWithInterval(DateInterval.Year, 3, testDate);
            expect(result.getFullYear()).toBe(2023);
        });

        test('should handle negative values', () => {
            const result = dateWithInterval(DateInterval.Day, -5, baseDate);
            expect(result.getTime()).toBe(
                baseDate.getTime() - 5 * MILLISECONDS_PER_DAY,
            );
        });

        test('should use current date when no date provided', () => {
            const beforeCall = new Date();
            const result = dateWithInterval(DateInterval.Second, 10);
            const afterCall = new Date();

            // The result should be approximately 10 seconds after the current time
            expect(result.getTime()).toBeGreaterThanOrEqual(
                beforeCall.getTime() + 10 * MILLISECONDS_PER_SECOND,
            );
            expect(result.getTime()).toBeLessThanOrEqual(
                afterCall.getTime() + 10 * MILLISECONDS_PER_SECOND,
            );
        });
    });

    describe('msToMinutes', () => {
        test('should convert milliseconds to minutes', () => {
            expect(millsecondsToMinutes(60000)).toBe(1);
            expect(millsecondsToMinutes(120000)).toBe(2);
            expect(millsecondsToMinutes(30000)).toBe(0.5);
        });

        test('should handle zero', () => {
            expect(millsecondsToMinutes(0)).toBe(0);
        });

        test('should handle fractional results', () => {
            expect(millsecondsToMinutes(90000)).toBe(1.5);
            expect(millsecondsToMinutes(45000)).toBe(0.75);
        });

        test('should handle large values', () => {
            expect(millsecondsToMinutes(3600000)).toBe(60); // 1 hour
            expect(millsecondsToMinutes(86400000)).toBe(1440); // 1 day
        });
    });

    describe('msToDayDisplay', () => {
        test('should return "less than a minute" for small values', () => {
            expect(millisecondsToDayDisplay(0)).toBe('less than a minute');
            expect(millisecondsToDayDisplay(30000)).toBe('less than a minute');
            expect(millisecondsToDayDisplay(59999)).toBe('less than a minute');
        });

        test('should display minutes only', () => {
            expect(millisecondsToDayDisplay(60000)).toBe('1 minutes');
            expect(millisecondsToDayDisplay(300000)).toBe('5 minutes');
            expect(millisecondsToDayDisplay(3540000)).toBe('59 minutes');
        });

        test('should display hours and minutes', () => {
            expect(millisecondsToDayDisplay(3600000)).toBe('1 hours');
            expect(millisecondsToDayDisplay(3660000)).toBe(
                '1 hours, 1 minutes',
            );
            expect(millisecondsToDayDisplay(7320000)).toBe(
                '2 hours, 2 minutes',
            );
        });

        test('should display days, hours, and minutes', () => {
            expect(millisecondsToDayDisplay(86400000)).toBe('1 days');
            expect(millisecondsToDayDisplay(90000000)).toBe('1 days, 1 hours');
            expect(millisecondsToDayDisplay(90060000)).toBe(
                '1 days, 1 hours, 1 minutes',
            );
        });

        test('should handle multiple days', () => {
            expect(millisecondsToDayDisplay(172800000)).toBe('2 days');
            expect(millisecondsToDayDisplay(176460000)).toBe(
                '2 days, 1 hours, 1 minutes',
            );
        });

        test('should handle large values', () => {
            const sevenDays =
                7 * MILLISECONDS_PER_DAY +
                2 * MILLISECONDS_PER_HOUR +
                30 * MILLISECONDS_PER_MINUTE;
            expect(millisecondsToDayDisplay(sevenDays)).toBe(
                '7 days, 2 hours, 30 minutes',
            );
        });

        test('should floor partial units', () => {
            const almostTwoDays = 2 * MILLISECONDS_PER_DAY - 1;
            expect(millisecondsToDayDisplay(almostTwoDays)).toBe(
                '1 days, 23 hours, 59 minutes',
            );
        });
    });

    describe('dateToISOStringWithTimezone', () => {
        test('should format date with current timezone offset', () => {
            const date = new Date('2023-06-15T14:30:45.123Z');
            const result = dateToISOStringWithTimezone(date);

            // The result should be in ISO format with timezone
            expect(result).toMatch(
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/,
            );

            // Should contain the correct date components (in local time)
            expect(result).toContain('2023-06-15');
            expect(result).toContain('.123');
        });

        test('should handle different millisecond values correctly', () => {
            const testCases = [
                { ms: 0, expected: '000' },
                { ms: 5, expected: '005' },
                { ms: 50, expected: '050' },
                { ms: 500, expected: '500' },
                { ms: 999, expected: '999' },
            ];

            testCases.forEach(({ ms, expected }) => {
                const date = new Date(
                    `2023-01-01T12:00:00.${ms.toString().padStart(3, '0')}Z`,
                );
                const result = dateToISOStringWithTimezone(date);
                expect(result).toContain(`.${expected}`);
            });
        });

        test('should produce consistent format structure', () => {
            const date = new Date('2023-01-05T09:05:05.005Z');
            const result = dateToISOStringWithTimezone(date);

            // Check overall format
            expect(result).toMatch(
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/,
            );

            // Check specific padding
            const parts = result.split('T');
            expect(parts[0]).toBe('2023-01-05'); // Date part should be correctly padded

            const timeParts = parts[1];
            expect(timeParts).toMatch(
                /^\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/,
            );
        });

        test('should handle timezone offset calculation correctly', () => {
            const date = new Date('2023-06-15T12:00:00.000Z');
            const result = dateToISOStringWithTimezone(date);

            // Extract timezone offset from result
            const offsetMatch = result.match(/([+-])(\d{2}):(\d{2})$/);
            expect(offsetMatch).toBeTruthy();

            if (offsetMatch) {
                const sign = offsetMatch[1];
                const hours = parseInt(offsetMatch[2], 10);
                const minutes = parseInt(offsetMatch[3], 10);

                // Verify it matches the actual timezone offset
                const actualOffset = -date.getTimezoneOffset();
                const expectedHours = Math.floor(Math.abs(actualOffset) / 60);
                const expectedMinutes = Math.abs(actualOffset) % 60;
                const expectedSign = actualOffset >= 0 ? '+' : '-';

                expect(sign).toBe(expectedSign);
                expect(hours).toBe(expectedHours);
                expect(minutes).toBe(expectedMinutes);
            }
        });

        test('should handle dates in different months and years', () => {
            const dates = [
                new Date('2020-02-29T12:00:00.000Z'), // Leap year
                new Date('2023-12-31T23:59:59.999Z'), // End of year
                new Date('2024-01-01T00:00:00.000Z'), // Start of year
            ];

            dates.forEach((date) => {
                const result = dateToISOStringWithTimezone(date);
                expect(result).toMatch(
                    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/,
                );
            });
        });
    });

    describe('Integration tests', () => {
        test('should convert Date to Unix time and back', () => {
            const originalDate = new Date('2023-06-15T12:30:45.000Z');
            const unixTime = dateToUnixTime(originalDate);
            const convertedDate = unixTimeToDate(unixTime);

            expect(convertedDate?.getTime()).toBe(originalDate.getTime());
        });

        test('should work with dateWithInterval and other functions', () => {
            const baseDate = new Date('2023-01-01T00:00:00.000Z');
            const futureDate = dateWithInterval(DateInterval.Day, 5, baseDate);
            const timeDiff = futureDate.getTime() - baseDate.getTime();

            expect(millisecondsToDayDisplay(timeDiff)).toBe('5 days');
            expect(millsecondsToMinutes(timeDiff)).toBe(7200); // 5 days * 24 hours * 60 minutes
        });
    });
});
