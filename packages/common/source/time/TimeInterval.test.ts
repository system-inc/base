// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { TimeInterval, timeIntervalToDateFormat } from './TimeInterval';

describe('TimeInterval', () => {
    describe('TimeInterval enum', () => {
        it('should have correct enum values', () => {
            expect(TimeInterval.Minute).toBe('Minute');
            expect(TimeInterval.Hour).toBe('Hour');
            expect(TimeInterval.HourOfDay).toBe('HourOfDay');
            expect(TimeInterval.Day).toBe('Day');
            expect(TimeInterval.DayOfWeek).toBe('DayOfWeek');
            expect(TimeInterval.Week).toBe('Week');
            expect(TimeInterval.WeekOfYear).toBe('WeekOfYear');
            expect(TimeInterval.DayOfMonth).toBe('DayOfMonth');
            expect(TimeInterval.Month).toBe('Month');
            expect(TimeInterval.MonthOfYear).toBe('MonthOfYear');
            expect(TimeInterval.Quarter).toBe('Quarter');
            expect(TimeInterval.Year).toBe('Year');
        });

        it('should have all expected enum keys', () => {
            const enumKeys = Object.keys(TimeInterval);
            const expectedKeys = [
                'Minute',
                'Hour',
                'HourOfDay',
                'Day',
                'DayOfWeek',
                'Week',
                'WeekOfYear',
                'DayOfMonth',
                'Month',
                'MonthOfYear',
                'Quarter',
                'Year',
            ];

            expect(enumKeys).toEqual(expectedKeys);
            expect(enumKeys).toHaveLength(12);
        });

        it('should have string values for all enum members', () => {
            Object.values(TimeInterval).forEach((value) => {
                expect(typeof value).toBe('string');
            });
        });

        it('should be usable in switch statements', () => {
            function getIntervalDescription(interval: TimeInterval): string {
                switch (interval) {
                    case TimeInterval.Hour:
                        return 'hour';
                    case TimeInterval.Day:
                        return 'day';
                    case TimeInterval.Month:
                        return 'month';
                    case TimeInterval.Minute:
                    case TimeInterval.HourOfDay:
                    case TimeInterval.DayOfWeek:
                    case TimeInterval.Week:
                    case TimeInterval.WeekOfYear:
                    case TimeInterval.DayOfMonth:
                    case TimeInterval.MonthOfYear:
                    case TimeInterval.Quarter:
                    case TimeInterval.Year:
                        return 'other';
                }
            }

            expect(getIntervalDescription(TimeInterval.Day)).toBe('day');
            expect(getIntervalDescription(TimeInterval.Hour)).toBe('hour');
            expect(getIntervalDescription(TimeInterval.Month)).toBe('month');
        });
    });

    describe('timeIntervalToDateFormat function', () => {
        it('should return correct format for Minute interval', () => {
            const result = timeIntervalToDateFormat(TimeInterval.Minute);
            expect(result).toBe('%Y-%m-%dT%H:%M:00Z');
        });

        it('should return correct format for Hour interval', () => {
            const result = timeIntervalToDateFormat(TimeInterval.Hour);
            expect(result).toBe('%Y-%m-%dT%H:00:00Z');
        });

        it('should return correct format for HourOfDay interval', () => {
            const result = timeIntervalToDateFormat(TimeInterval.HourOfDay);
            expect(result).toBe('%H');
        });

        it('should return correct format for Day interval', () => {
            const result = timeIntervalToDateFormat(TimeInterval.Day);
            expect(result).toBe('%Y-%m-%d');
        });

        it('should return correct format for DayOfWeek interval', () => {
            const result = timeIntervalToDateFormat(TimeInterval.DayOfWeek);
            expect(result).toBe('%w');
        });

        it('should return correct format for Week interval', () => {
            const result = timeIntervalToDateFormat(TimeInterval.Week);
            expect(result).toBe('%Y-%v');
        });

        it('should return correct format for WeekOfYear interval', () => {
            const result = timeIntervalToDateFormat(TimeInterval.WeekOfYear);
            expect(result).toBe('%v');
        });

        it('should return correct format for DayOfMonth interval', () => {
            const result = timeIntervalToDateFormat(TimeInterval.DayOfMonth);
            expect(result).toBe('%d');
        });

        it('should return correct format for Month interval', () => {
            const result = timeIntervalToDateFormat(TimeInterval.Month);
            expect(result).toBe('%Y-%m');
        });

        it('should return correct format for MonthOfYear interval', () => {
            const result = timeIntervalToDateFormat(TimeInterval.MonthOfYear);
            expect(result).toBe('%m');
        });

        it('should return correct format for Quarter interval', () => {
            const result = timeIntervalToDateFormat(TimeInterval.Quarter);
            expect(result).toBe('%Y-%M');
        });

        it('should return correct format for Year interval', () => {
            const result = timeIntervalToDateFormat(TimeInterval.Year);
            expect(result).toBe('%Y');
        });

        it('should handle all enum values in a loop', () => {
            const expectedFormats: Record<TimeInterval, string> = {
                [TimeInterval.Minute]: '%Y-%m-%dT%H:%M:00Z',
                [TimeInterval.Hour]: '%Y-%m-%dT%H:00:00Z',
                [TimeInterval.HourOfDay]: '%H',
                [TimeInterval.Day]: '%Y-%m-%d',
                [TimeInterval.DayOfWeek]: '%w',
                [TimeInterval.Week]: '%Y-%v',
                [TimeInterval.WeekOfYear]: '%v',
                [TimeInterval.DayOfMonth]: '%d',
                [TimeInterval.Month]: '%Y-%m',
                [TimeInterval.MonthOfYear]: '%m',
                [TimeInterval.Quarter]: '%Y-%M',
                [TimeInterval.Year]: '%Y',
            };

            Object.values(TimeInterval).forEach((interval) => {
                const result = timeIntervalToDateFormat(interval);
                expect(result).toBe(expectedFormats[interval]);
            });
        });

        it('should return string values for all inputs', () => {
            Object.values(TimeInterval).forEach((interval) => {
                const result = timeIntervalToDateFormat(interval);
                expect(typeof result).toBe('string');
                expect(result.length).toBeGreaterThan(0);
            });
        });
    });

    describe('date format patterns', () => {
        it('should use ISO date format for Day interval', () => {
            const result = timeIntervalToDateFormat(TimeInterval.Day);
            expect(result).toBe('%Y-%m-%d');
            expect(result).toMatch(/^%Y-%m-%d$/);
        });

        it('should include minute formatting for Minute interval', () => {
            const result = timeIntervalToDateFormat(TimeInterval.Minute);
            expect(result).toBe('%Y-%m-%dT%H:%M:00Z');
            expect(result).toContain('%H');
            expect(result).toContain('%M');
            expect(result).toContain('%Y-%m-%d');
        });

        it('should include hour formatting for Hour interval', () => {
            const result = timeIntervalToDateFormat(TimeInterval.Hour);
            expect(result).toBe('%Y-%m-%dT%H:00:00Z');
            expect(result).toContain('%H');
            expect(result).toContain('%Y-%m-%d');
        });

        it('should use only hour for HourOfDay interval', () => {
            const result = timeIntervalToDateFormat(TimeInterval.HourOfDay);
            expect(result).toBe('%H');
            expect(result).not.toContain('%Y');
            expect(result).not.toContain('%m');
            expect(result).not.toContain('%d');
        });

        it('should use only day number for DayOfMonth interval', () => {
            const result = timeIntervalToDateFormat(TimeInterval.DayOfMonth);
            expect(result).toBe('%d');
            expect(result).not.toContain('%Y');
            expect(result).not.toContain('%m');
        });

        it('should use day of week for DayOfWeek interval', () => {
            const result = timeIntervalToDateFormat(TimeInterval.DayOfWeek);
            expect(result).toBe('%w');
            expect(result).not.toContain('%Y');
            expect(result).not.toContain('%m');
            expect(result).not.toContain('%d');
        });

        it('should use year-month format for Month interval', () => {
            const result = timeIntervalToDateFormat(TimeInterval.Month);
            expect(result).toBe('%Y-%m');
            expect(result).toContain('%Y');
            expect(result).toContain('%m');
            expect(result).not.toContain('%d');
        });

        it('should use only month number for MonthOfYear interval', () => {
            const result = timeIntervalToDateFormat(TimeInterval.MonthOfYear);
            expect(result).toBe('%m');
            expect(result).not.toContain('%Y');
            expect(result).not.toContain('%d');
        });

        it('should use year format for Year interval', () => {
            const result = timeIntervalToDateFormat(TimeInterval.Year);
            expect(result).toBe('%Y');
            expect(result).not.toContain('%m');
            expect(result).not.toContain('%d');
        });

        it('should use special format for Quarter interval', () => {
            const result = timeIntervalToDateFormat(TimeInterval.Quarter);
            expect(result).toBe('%Y-%M');
            expect(result).toContain('%Y');
            expect(result).toContain('%M'); // Note: capital M for quarter
        });
    });

    describe('format string validation', () => {
        it('should return valid strftime format strings', () => {
            Object.values(TimeInterval).forEach((interval) => {
                const result = timeIntervalToDateFormat(interval);

                // Should start with % (strftime format indicator)
                expect(result).toMatch(/%/);

                // Should not contain invalid characters for strftime (including T and Z for ISO-8601)
                expect(result).not.toMatch(/[^%YmdHwMvTZ:\-\s0]/);
            });
        });

        it('should return non-empty strings', () => {
            Object.values(TimeInterval).forEach((interval) => {
                const result = timeIntervalToDateFormat(interval);
                expect(result).toBeTruthy();
                expect(result.length).toBeGreaterThan(0);
            });
        });

        it('should return consistent results', () => {
            // Test that calling the function multiple times returns the same result
            Object.values(TimeInterval).forEach((interval) => {
                const result1 = timeIntervalToDateFormat(interval);
                const result2 = timeIntervalToDateFormat(interval);
                expect(result1).toBe(result2);
            });
        });
    });

    describe('edge cases and type safety', () => {
        it('should handle invalid enum values gracefully', () => {
            // This tests the default case behavior
            const invalidInterval = 'InvalidInterval' as TimeInterval;
            const result = timeIntervalToDateFormat(invalidInterval);
            expect(result).toBe('%Y-%m-%d'); // Should return default format
        });

        it('should be type-safe with TypeScript', () => {
            // This test ensures the function accepts only TimeInterval enum values
            const validInterval: TimeInterval = TimeInterval.Hour;
            const result = timeIntervalToDateFormat(validInterval);
            expect(typeof result).toBe('string');
        });

        it('should work with enum destructuring', () => {
            const { Hour, Day, Month } = TimeInterval;

            expect(timeIntervalToDateFormat(Hour)).toBe('%Y-%m-%dT%H:00:00Z');
            expect(timeIntervalToDateFormat(Day)).toBe('%Y-%m-%d');
            expect(timeIntervalToDateFormat(Month)).toBe('%Y-%m');
        });

        it('should work with array iteration', () => {
            const intervals = [
                TimeInterval.Hour,
                TimeInterval.Day,
                TimeInterval.Month,
                TimeInterval.Year,
            ];

            const results = intervals.map(timeIntervalToDateFormat);

            expect(results).toHaveLength(4);
            expect(results[0]).toBe('%Y-%m-%dT%H:00:00Z');
            expect(results[1]).toBe('%Y-%m-%d');
            expect(results[2]).toBe('%Y-%m');
            expect(results[3]).toBe('%Y');
        });
    });

    describe('practical usage scenarios', () => {
        it('should support time series grouping use cases', () => {
            // Scenario: Daily analytics dashboard
            const dailyFormat = timeIntervalToDateFormat(TimeInterval.Day);
            expect(dailyFormat).toBe('%Y-%m-%d');

            // Scenario: Hourly metrics tracking
            const hourlyFormat = timeIntervalToDateFormat(TimeInterval.Hour);
            expect(hourlyFormat).toBe('%Y-%m-%dT%H:00:00Z');

            // Scenario: Monthly reports
            const monthlyFormat = timeIntervalToDateFormat(TimeInterval.Month);
            expect(monthlyFormat).toBe('%Y-%m');

            // Scenario: Yearly summaries
            const yearlyFormat = timeIntervalToDateFormat(TimeInterval.Year);
            expect(yearlyFormat).toBe('%Y');
        });

        it('should support relative time analysis', () => {
            // Scenario: Day of week patterns (Monday=1, Sunday=0)
            const dayOfWeekFormat = timeIntervalToDateFormat(
                TimeInterval.DayOfWeek,
            );
            expect(dayOfWeekFormat).toBe('%w');

            // Scenario: Hour of day patterns (0-23)
            const hourOfDayFormat = timeIntervalToDateFormat(
                TimeInterval.HourOfDay,
            );
            expect(hourOfDayFormat).toBe('%H');

            // Scenario: Day of month patterns (1-31)
            const dayOfMonthFormat = timeIntervalToDateFormat(
                TimeInterval.DayOfMonth,
            );
            expect(dayOfMonthFormat).toBe('%d');

            // Scenario: Month of year patterns (1-12)
            const monthOfYearFormat = timeIntervalToDateFormat(
                TimeInterval.MonthOfYear,
            );
            expect(monthOfYearFormat).toBe('%m');
        });

        it('should support quarterly business reporting', () => {
            // Scenario: Quarterly business reports
            const quarterFormat = timeIntervalToDateFormat(
                TimeInterval.Quarter,
            );
            expect(quarterFormat).toBe('%Y-%M');

            // Verify it includes year for quarterly tracking across years
            expect(quarterFormat).toContain('%Y');
        });

        it('should generate formats suitable for SQL date functions', () => {
            // These formats should be compatible with SQL DATE_FORMAT function
            const formats = Object.values(TimeInterval).map(
                timeIntervalToDateFormat,
            );

            formats.forEach((format) => {
                expect(format).toMatch(/^%[YmdHwMv]/); // Should start with % followed by format specifier
                expect(format).not.toContain('undefined');
                expect(format).not.toContain('null');
            });
        });
    });
});
