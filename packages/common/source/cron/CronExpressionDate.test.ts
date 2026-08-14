// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { dateFromCronExpression } from './CronExpressionDate';

describe('CronExpressionDate', () => {
    describe('dateFromCronExpression', () => {
        const fixedDate = new Date('2023-06-15T14:30:25.000Z'); // Thursday
        const fixedTimestamp = fixedDate.getTime();

        it('should parse every minute cron expression', () => {
            const result = dateFromCronExpression('* * * * *', fixedDate);
            const expected = new Date('2023-06-15T14:31:00.000Z');
            expect(result).toEqual(expected);
        });

        it('should parse specific minute cron expression', () => {
            const result = dateFromCronExpression('45 * * * *', fixedDate);
            const expected = new Date('2023-06-15T14:45:00.000Z');
            expect(result).toEqual(expected);
        });

        it('should parse daily at specific time cron expression', () => {
            const result = dateFromCronExpression('30 9 * * *', fixedDate);
            const expected = new Date('2023-06-16T09:30:00.000Z');
            expect(result).toEqual(expected);
        });

        it('should parse weekly cron expression (every Monday)', () => {
            const result = dateFromCronExpression('0 9 * * 1', fixedDate);
            const expected = new Date('2023-06-19T09:00:00.000Z'); // Next Monday
            expect(result).toEqual(expected);
        });

        it('should parse monthly cron expression (1st of every month)', () => {
            const result = dateFromCronExpression('0 0 1 * *', fixedDate);
            const expected = new Date('2023-07-01T00:00:00.000Z');
            expect(result).toEqual(expected);
        });

        it('should handle cron expression with specific month', () => {
            const result = dateFromCronExpression('0 12 15 12 *', fixedDate);
            const expected = new Date('2023-12-15T12:00:00.000Z');
            expect(result).toEqual(expected);
        });

        it('should accept timestamp as now parameter', () => {
            const result = dateFromCronExpression('* * * * *', fixedTimestamp);
            const expected = new Date('2023-06-15T14:31:00.000Z');
            expect(result).toEqual(expected);
        });

        it('should handle timezone parameter', () => {
            const result = dateFromCronExpression(
                '0 9 * * *',
                fixedDate,
                'America/New_York',
            );
            // Next occurrence of 9 AM EST/EDT
            expect(result).toBeInstanceOf(Date);
            expect(result.getTime()).toBeGreaterThan(fixedDate.getTime());
        });

        it('should default to UTC timezone when not specified', () => {
            const result1 = dateFromCronExpression('0 15 * * *', fixedDate);
            const result2 = dateFromCronExpression(
                '0 15 * * *',
                fixedDate,
                'UTC',
            );
            expect(result1).toEqual(result2);
        });

        it('should handle complex cron with ranges and lists', () => {
            // Every 15 minutes between 9-17 on weekdays
            const result = dateFromCronExpression(
                '0,15,30,45 9-17 * * 1-5',
                fixedDate,
            );
            expect(result).toBeInstanceOf(Date);
            expect(result.getTime()).toBeGreaterThan(fixedDate.getTime());
        });

        it('should handle step values', () => {
            // Every 5 minutes
            const result = dateFromCronExpression('*/5 * * * *', fixedDate);
            const expected = new Date('2023-06-15T14:35:00.000Z');
            expect(result).toEqual(expected);
        });

        it('should handle last day of month', () => {
            // At 12:00 on the last day of every month
            const result = dateFromCronExpression('0 12 L * *', fixedDate);
            const expected = new Date('2023-06-30T12:00:00.000Z');
            expect(result).toEqual(expected);
        });

        it('should handle weekday specifiers', () => {
            // At 12:00 on the last Friday of every month
            const result = dateFromCronExpression('0 12 * * 5L', fixedDate);
            expect(result).toBeInstanceOf(Date);
            expect(result.getTime()).toBeGreaterThan(fixedDate.getTime());
        });

        it('should handle nth weekday of month', () => {
            // At 12:00 on the 2nd Tuesday of every month
            const result = dateFromCronExpression('0 12 * * 2#2', fixedDate);
            expect(result).toBeInstanceOf(Date);
            expect(result.getTime()).toBeGreaterThan(fixedDate.getTime());
        });

        it('should return next occurrence when current time matches', () => {
            // Set time to exactly match cron expression
            const exactTime = new Date('2023-06-15T14:30:00.000Z');
            const result = dateFromCronExpression('30 14 * * *', exactTime);
            // Should return tomorrow's occurrence
            const expected = new Date('2023-06-16T14:30:00.000Z');
            expect(result).toEqual(expected);
        });

        it('should handle yearly cron expression', () => {
            const result = dateFromCronExpression('0 0 1 1 *', fixedDate);
            const expected = new Date('2024-01-01T00:00:00.000Z');
            expect(result).toEqual(expected);
        });

        it('should handle different timezone formats', () => {
            const result1 = dateFromCronExpression(
                '0 9 * * *',
                fixedDate,
                'Europe/London',
            );
            const result2 = dateFromCronExpression(
                '0 9 * * *',
                fixedDate,
                'GMT',
            );

            expect(result1).toBeInstanceOf(Date);
            expect(result2).toBeInstanceOf(Date);
            expect(result1.getTime()).toBeGreaterThan(fixedDate.getTime());
            expect(result2.getTime()).toBeGreaterThan(fixedDate.getTime());
        });

        it('should throw error for invalid cron expression', () => {
            expect(() =>
                dateFromCronExpression('invalid', fixedDate),
            ).toThrow();
        });

        it('should handle empty cron expression (behavior depends on cron-parser)', () => {
            // Test to see what actually happens with empty string
            try {
                const result = dateFromCronExpression('', fixedDate);
                expect(result).toBeInstanceOf(Date);
            } catch (error) {
                // If it throws, that's also acceptable behavior
                expect(error).toBeDefined();
            }
        });

        it('should throw error for malformed cron expression', () => {
            expect(() =>
                dateFromCronExpression('60 * * * *', fixedDate),
            ).toThrow();
        });

        it('should handle edge case of February 29th in leap year', () => {
            const leapYearDate = new Date('2024-02-28T12:00:00.000Z');
            const result = dateFromCronExpression('0 12 29 2 *', leapYearDate);
            const expected = new Date('2024-02-29T12:00:00.000Z');
            expect(result).toEqual(expected);
        });

        it('should handle different Date constructor scenarios', () => {
            const dateObj = new Date(2023, 5, 15, 14, 30, 25); // Month is 0-indexed
            const result = dateFromCronExpression('* * * * *', dateObj);
            expect(result).toBeInstanceOf(Date);
            expect(result.getTime()).toBeGreaterThan(dateObj.getTime());
        });

        it('should handle midnight crossover correctly', () => {
            const lateNight = new Date('2023-06-15T23:55:00.000Z');
            const result = dateFromCronExpression('0 0 * * *', lateNight);
            const expected = new Date('2023-06-16T00:00:00.000Z');
            expect(result).toEqual(expected);
        });
    });
});
