// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Sentinel that causes a ScheduledExecutable to run on every trigger the
 * worker receives, regardless of which cron actually fired. Not a real cron
 * expression — handled as a special case by cronExpressionIsValid and the
 * ScheduledRunner.
 */
export const CRON_ANY_TRIGGER = 'ANY_TRIGGER';

/**
 * Runs every minute
 */
export const CRON_EVERY_MINUTE = '* * * * *';

/**
 * Runs every 5 minutes
 */
export const CRON_EVERY_5_MINUTES = '*/5 * * * *';

/**
 * Runs every 10 minutes
 */
export const CRON_EVERY_10_MINUTES = '*/10 * * * *';

/**
 * Runs every 15 minutes
 */
export const CRON_EVERY_15_MINUTES = '*/15 * * * *';

/**
 * Runs every 30 minutes
 */
export const CRON_EVERY_30_MINUTES = '*/30 * * * *';

/**
 * Runs at the start of every hour
 */
export const CRON_EVERY_HOUR = '0 * * * *';

/**
 * Runs every 2 hours
 */
export const CRON_EVERY_2_HOURS = '0 */2 * * *';

/**
 * Runs every 6 hours
 */
export const CRON_EVERY_6_HOURS = '0 */6 * * *';

/**
 * Runs every 12 hours
 */
export const CRON_EVERY_12_HOURS = '0 */12 * * *';

/**
 * Runs at midnight every day
 */
export const CRON_EVERY_DAY_AT_MIDNIGHT = '0 0 * * *';

/**
 * Runs at noon every day
 */
export const CRON_EVERY_DAY_AT_NOON = '0 12 * * *';

/**
 * Runs at 3 AM every day
 */
export const CRON_EVERY_DAY_AT_3AM = '0 3 * * *';

/**
 * Runs at 6 AM every day
 */
export const CRON_EVERY_DAY_AT_6AM = '0 6 * * *';

/**
 * Runs at midnight on Sunday (once a week)
 */
export const CRON_EVERY_WEEK = '0 0 * * 0';

/**
 * Runs every Monday at 9 AM
 */
export const CRON_EVERY_MONDAY_MORNING = '0 9 * * 1';

/**
 * Runs every Friday at 6 PM
 */
export const CRON_EVERY_FRIDAY_EVENING = '0 18 * * 5';

/**
 * Runs at midnight on the first day of every month
 */
export const CRON_EVERY_MONTH_FIRST_DAY = '0 0 1 * *';
/**
 * Runs at midnight on the first Monday of the month
 */
export const CRON_EVERY_MONTH_FIRST_MONDAY = '0 0 * * 1#1';

/**
 * Runs at midnight on January 1st every year
 */
export const CRON_EVERY_YEAR = '0 0 1 1 *';

/**
 * Runs at 9 AM Monday through Friday
 */
export const CRON_WEEKDAYS_AT_9AM = '0 9 * * 1-5';

/**
 * Runs at 10 AM on Saturday and Sunday
 */
export const CRON_WEEKENDS_AT_10AM = '0 10 * * 6,7';

/**
 * Runs on the first day of each quarter
 */
export const CRON_FIRST_DAY_EVERY_QUARTER = '0 0 1 1,4,7,10 *';

/**
 * Runs at midnight on the last day of every month (if L is supported)
 */
export const CRON_LAST_DAY_OF_MONTH = '0 0 L * *';

/**
 * Runs at midnight on the last weekday of every month
 */
export const CRON_LAST_WEEKDAY_OF_MONTH = '0 0 LW * *';

/**
 * Runs at midnight on the last Friday of every month
 */
export const CRON_LAST_FRIDAY_OF_MONTH = '0 0 * * 5L';

/**
 * Determines if a cron expression is valid.
 *
 * @param cronExpression
 * @returns
 */
export function cronExpressionIsValid(cronExpression: string): boolean {
    if (cronExpression === CRON_ANY_TRIGGER) return true;

    const parts = cronExpression.trim().split(/\s+/);
    if (parts.length !== 5) return false; // Standard cron has exactly 5 fields

    // Check for empty parts (caused by multiple spaces)
    if (parts.some((part) => part === '')) return false;

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    const isValidPart = (part: string, min: number, max: number) => {
        if (part === '*') return true;

        // Check for malformed expressions (trailing commas, slashes, dashes)
        if (
            part.endsWith(',') ||
            part.endsWith('/') ||
            part.endsWith('-') ||
            part.startsWith(',') ||
            part.startsWith('/') ||
            part.startsWith('-')
        ) {
            return false;
        }

        return part.split(',').every((subPart) => {
            // Check for empty parts in comma-separated list
            if (subPart === '') return false;

            if (subPart.includes('/')) {
                const slashParts = subPart.split('/');
                // Must have exactly 2 parts for step syntax
                if (slashParts.length !== 2) return false;

                const [range, step] = slashParts;
                return (
                    isValidRange(range, min, max) &&
                    isValidNumber(step) &&
                    isNumberInRange(step, 1, max)
                );
            }
            return isValidRange(subPart, min, max);
        });
    };

    const isValidRange = (range: string, min: number, max: number) => {
        if (range === '*') return true; // Allow '*' in step expressions like "*/5"
        if (range.includes('-')) {
            const dashParts = range.split('-');
            // Must have exactly 2 parts for range syntax
            if (dashParts.length !== 2) return false;

            const [start, end] = dashParts.map(Number);
            return (
                isValidNumber(dashParts[0]) &&
                isValidNumber(dashParts[1]) &&
                isNumberInRange(start, min, max) &&
                isNumberInRange(end, min, max) &&
                start <= end
            );
        }
        return isValidNumber(range) && isNumberInRange(range, min, max);
    };

    const isValidNumber = (value: string) => {
        // Check if it's a valid positive integer (no decimals, no negative signs)
        return /^\d+$/.test(value) && value !== '';
    };

    const isNumberInRange = (
        value: string | number,
        min: number,
        max: number,
    ) => {
        const num = Number(value);
        return !isNaN(num) && num >= min && num <= max && Number.isInteger(num);
    };

    // The day-of-month and day-of-week fields additionally accept the
    // Cloudflare-supported special tokens (L, W, #) — the same ones the
    // exported CRON_LAST_* / CRON_EVERY_MONTH_FIRST_MONDAY constants use.
    const isValidDayOfMonth = (part: string): boolean => {
        // L (last day), LW (last weekday), nW (nearest weekday to day n)
        if (part === 'L' || part === 'LW') return true;
        const nearestWeekday = /^(\d+)W$/.exec(part);
        if (nearestWeekday) {
            return isNumberInRange(nearestWeekday[1], 1, 31);
        }
        return isValidPart(part, 1, 31);
    };

    const isValidDayOfWeek = (part: string): boolean => {
        // L (last day of week), nL (last given weekday), n#m (mth given weekday)
        if (part === 'L') return true;
        const lastWeekday = /^(\d+)L$/.exec(part);
        if (lastWeekday) {
            return isNumberInRange(lastWeekday[1], 0, 7);
        }
        const nthWeekday = /^(\d+)#(\d+)$/.exec(part);
        if (nthWeekday) {
            return (
                isNumberInRange(nthWeekday[1], 0, 7) &&
                isNumberInRange(nthWeekday[2], 1, 5)
            );
        }
        return isValidPart(part, 0, 7);
    };

    return (
        isValidPart(minute, 0, 59) &&
        isValidPart(hour, 0, 23) &&
        isValidDayOfMonth(dayOfMonth) &&
        isValidPart(month, 1, 12) &&
        isValidDayOfWeek(dayOfWeek) // 0 and 7 both represent Sunday
    );
}
