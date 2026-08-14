// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { CronExpressionParser } from 'cron-parser';

/**
 * Converts a cron expression into a Date object based on the current time.
 *
 * @param cronExpression
 * @param now
 * @param timeZone
 * @returns
 */
export function dateFromCronExpression(
    cronExpression: string,
    now: number | Date,
    timeZone?: string,
): Date {
    const interval = CronExpressionParser.parse(cronExpression, {
        currentDate: now,
        tz: timeZone ?? 'UTC',
    });
    return interval.next().toDate();
}
