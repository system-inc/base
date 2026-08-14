// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import * as CronExpression from './CronExpression';
import { cronExpressionIsValid } from './CronExpression';

describe('CronExpression', () => {
    describe('cronExpressionIsValid', () => {
        test('accepts the L / LW / nL / n#m special tokens', () => {
            expect(cronExpressionIsValid('0 0 L * *')).toBe(true); // last day
            expect(cronExpressionIsValid('0 0 LW * *')).toBe(true); // last weekday
            expect(cronExpressionIsValid('0 0 15W * *')).toBe(true); // nearest weekday
            expect(cronExpressionIsValid('0 0 * * 5L')).toBe(true); // last Friday
            expect(cronExpressionIsValid('0 0 * * 1#1')).toBe(true); // first Monday
        });

        test('still rejects malformed special tokens', () => {
            expect(cronExpressionIsValid('0 0 * * 9#1')).toBe(false); // weekday > 7
            expect(cronExpressionIsValid('0 0 * * 1#6')).toBe(false); // nth > 5
            expect(cronExpressionIsValid('0 0 32W * *')).toBe(false); // day > 31
        });

        test('every exported CRON_* constant validates', () => {
            for (const [name, value] of Object.entries(CronExpression)) {
                if (name.startsWith('CRON_')) {
                    expect([
                        name,
                        cronExpressionIsValid(value as string),
                    ]).toEqual([name, true]);
                }
            }
        });

        test('should return true for valid basic cron expressions', () => {
            expect(cronExpressionIsValid('* * * * *')).toBe(true);
            expect(cronExpressionIsValid('0 0 * * *')).toBe(true);
            expect(cronExpressionIsValid('30 14 * * *')).toBe(true);
            expect(cronExpressionIsValid('0 9 * * 1-5')).toBe(true);
            expect(cronExpressionIsValid('*/5 * * * *')).toBe(true);
        });

        test('should return true for valid minute values', () => {
            expect(cronExpressionIsValid('0 * * * *')).toBe(true);
            expect(cronExpressionIsValid('59 * * * *')).toBe(true);
            expect(cronExpressionIsValid('*/15 * * * *')).toBe(true);
            expect(cronExpressionIsValid('0,15,30,45 * * * *')).toBe(true);
            expect(cronExpressionIsValid('0-30 * * * *')).toBe(true);
        });

        test('should return true for valid hour values', () => {
            expect(cronExpressionIsValid('* 0 * * *')).toBe(true);
            expect(cronExpressionIsValid('* 23 * * *')).toBe(true);
            expect(cronExpressionIsValid('* */6 * * *')).toBe(true);
            expect(cronExpressionIsValid('* 9,12,15 * * *')).toBe(true);
            expect(cronExpressionIsValid('* 9-17 * * *')).toBe(true);
        });

        test('should return true for valid day of month values', () => {
            expect(cronExpressionIsValid('* * 1 * *')).toBe(true);
            expect(cronExpressionIsValid('* * 31 * *')).toBe(true);
            expect(cronExpressionIsValid('* * */7 * *')).toBe(true);
            expect(cronExpressionIsValid('* * 1,15 * *')).toBe(true);
            expect(cronExpressionIsValid('* * 1-15 * *')).toBe(true);
        });

        test('should return true for valid month values', () => {
            expect(cronExpressionIsValid('* * * 1 *')).toBe(true);
            expect(cronExpressionIsValid('* * * 12 *')).toBe(true);
            expect(cronExpressionIsValid('* * * */3 *')).toBe(true);
            expect(cronExpressionIsValid('* * * 1,6,12 *')).toBe(true);
            expect(cronExpressionIsValid('* * * 3-9 *')).toBe(true);
        });

        test('should return true for valid day of week values', () => {
            expect(cronExpressionIsValid('* * * * 0')).toBe(true); // Sunday
            expect(cronExpressionIsValid('* * * * 7')).toBe(true); // Sunday (alternative)
            expect(cronExpressionIsValid('* * * * 1-5')).toBe(true); // Monday to Friday
            expect(cronExpressionIsValid('* * * * 1,3,5')).toBe(true); // Mon, Wed, Fri
            expect(cronExpressionIsValid('* * * * */2')).toBe(true);
        });

        test('should return true for complex valid expressions', () => {
            expect(cronExpressionIsValid('0 9-17/2 * * 1-5')).toBe(true);
            expect(cronExpressionIsValid('*/10 8-18 1,15 * *')).toBe(true);
            expect(cronExpressionIsValid('0 0 1 1,4,7,10 *')).toBe(true);
            expect(cronExpressionIsValid('30 6-18/3 * * 1-5')).toBe(true);
        });

        test('should return false for invalid number of fields', () => {
            expect(cronExpressionIsValid('')).toBe(false);
            expect(cronExpressionIsValid('* * * *')).toBe(false); // Only 4 fields
            expect(cronExpressionIsValid('* * * * * *')).toBe(false); // 6 fields
            expect(cronExpressionIsValid('*')).toBe(false);
        });

        test('should return false for invalid minute values', () => {
            expect(cronExpressionIsValid('-1 * * * *')).toBe(false);
            expect(cronExpressionIsValid('60 * * * *')).toBe(false);
            expect(cronExpressionIsValid('abc * * * *')).toBe(false);
            expect(cronExpressionIsValid('0-60 * * * *')).toBe(false);
        });

        test('should return false for invalid hour values', () => {
            expect(cronExpressionIsValid('* -1 * * *')).toBe(false);
            expect(cronExpressionIsValid('* 24 * * *')).toBe(false);
            expect(cronExpressionIsValid('* xyz * * *')).toBe(false);
            expect(cronExpressionIsValid('* 0-24 * * *')).toBe(false);
        });

        test('should return false for invalid day of month values', () => {
            expect(cronExpressionIsValid('* * 0 * *')).toBe(false);
            expect(cronExpressionIsValid('* * 32 * *')).toBe(false);
            expect(cronExpressionIsValid('* * day * *')).toBe(false);
            expect(cronExpressionIsValid('* * 1-32 * *')).toBe(false);
        });

        test('should return false for invalid month values', () => {
            expect(cronExpressionIsValid('* * * 0 *')).toBe(false);
            expect(cronExpressionIsValid('* * * 13 *')).toBe(false);
            expect(cronExpressionIsValid('* * * jan *')).toBe(false);
            expect(cronExpressionIsValid('* * * 1-13 *')).toBe(false);
        });

        test('should return false for invalid day of week values', () => {
            expect(cronExpressionIsValid('* * * * -1')).toBe(false);
            expect(cronExpressionIsValid('* * * * 8')).toBe(false);
            expect(cronExpressionIsValid('* * * * mon')).toBe(false);
            expect(cronExpressionIsValid('* * * * 0-8')).toBe(false);
        });

        test('should return false for invalid range syntax', () => {
            expect(cronExpressionIsValid('5-2 * * * *')).toBe(false); // start > end
            expect(cronExpressionIsValid('* 10-5 * * *')).toBe(false); // start > end
            expect(cronExpressionIsValid('* * 15-10 * *')).toBe(false); // start > end
            expect(cronExpressionIsValid('1-2-3 * * * *')).toBe(false); // multiple dashes
        });

        test('should return false for invalid step syntax', () => {
            expect(cronExpressionIsValid('*/0 * * * *')).toBe(false); // step cannot be 0
            expect(cronExpressionIsValid('*/-5 * * * *')).toBe(false); // negative step
            expect(cronExpressionIsValid('*/abc * * * *')).toBe(false); // non-numeric step
            expect(cronExpressionIsValid('*/60 * * * *')).toBe(false); // step out of range
        });

        test('should return false for malformed expressions', () => {
            expect(cronExpressionIsValid('* * * * *,')).toBe(false);
            expect(cronExpressionIsValid(',* * * * *')).toBe(false);
            expect(cronExpressionIsValid('* * * * */')).toBe(false);
            expect(cronExpressionIsValid('/* * * * *')).toBe(false);
            expect(cronExpressionIsValid('* * * * *-')).toBe(false);
            expect(cronExpressionIsValid('-* * * * *')).toBe(false);
        });

        test('should handle whitespace correctly', () => {
            expect(cronExpressionIsValid('  * * * * *  ')).toBe(true); // Leading/trailing spaces
            expect(cronExpressionIsValid('*  *  *  *  *')).toBe(true); // Multiple spaces between fields
            expect(cronExpressionIsValid('* \t * \t * \t * \t *')).toBe(true); // Tabs between fields
        });

        test('should return false for missing fields', () => {
            expect(cronExpressionIsValid('* * * * ')).toBe(false); // Missing last field
            expect(cronExpressionIsValid(' * * * *')).toBe(false); // Missing first field after trim + split
        });

        test('should validate comma-separated values correctly', () => {
            expect(cronExpressionIsValid('1,2,3 * * * *')).toBe(true);
            expect(cronExpressionIsValid('0,15,30,45 * * * *')).toBe(true);
            expect(cronExpressionIsValid('1,2,60 * * * *')).toBe(false); // One invalid value in list
            expect(cronExpressionIsValid('1,abc,3 * * * *')).toBe(false); // Non-numeric in list
            expect(cronExpressionIsValid('1,,3 * * * *')).toBe(false); // Empty value in list
        });

        test('should validate complex step expressions', () => {
            expect(cronExpressionIsValid('0-30/5 * * * *')).toBe(true);
            expect(cronExpressionIsValid('*/15 9-17/2 * * *')).toBe(true);
            expect(cronExpressionIsValid('0-60/5 * * * *')).toBe(false); // Range exceeds max
            expect(cronExpressionIsValid('0-30/0 * * * *')).toBe(false); // Step cannot be 0
        });
    });
});
