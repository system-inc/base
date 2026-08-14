// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

export const MILLISECONDS_PER_SECOND = 1000;
export const MILLISECONDS_PER_MINUTE = 60 * 1000;
export const MILLISECONDS_PER_HOUR = 60 * MILLISECONDS_PER_MINUTE;
export const MILLISECONDS_PER_DAY = 24 * MILLISECONDS_PER_HOUR;

/**
 * Converts a Date to Unix time (seconds since epoch).
 *
 * @param date
 * @returns
 */
export function dateToUnixTime(date: Date): number {
    return Math.floor(date.getTime() / MILLISECONDS_PER_SECOND);
}

/**
 * Converts Unix time (seconds since epoch) to a Date object.
 *
 * @param unixTime
 * @returns
 */
export function unixTimeToDate(
    unixTime: number | null | undefined,
): Date | null {
    if (!unixTime) {
        return null;
    }
    return new Date(unixTime * MILLISECONDS_PER_SECOND);
}

/**
 * Converts an ISO date string to a Date object, returning null if the input is null.
 *
 * @param value
 * @returns
 */
export function dateFromString(value: string | null): Date | null {
    return value ? new Date(value) : null;
}

export enum DateInterval {
    Second = 'Second',
    Minute = 'Minute',
    Hour = 'Hour',
    Day = 'Day',
    Week = 'Week',
    Month = 'Month',
    Quarter = 'Quarter',
    Year = 'Year',
}

export function dateWithInterval(
    interval: DateInterval,
    value: number,
    date: Date = new Date(),
): Date {
    switch (interval) {
        case DateInterval.Second:
            return new Date(date.getTime() + value * MILLISECONDS_PER_SECOND);
        case DateInterval.Minute:
            return new Date(date.getTime() + value * MILLISECONDS_PER_MINUTE);
        case DateInterval.Hour:
            return new Date(date.getTime() + value * MILLISECONDS_PER_HOUR);
        case DateInterval.Day:
            return new Date(date.getTime() + value * MILLISECONDS_PER_DAY);
        case DateInterval.Week:
            return new Date(date.getTime() + value * MILLISECONDS_PER_DAY * 7);
        // Month/Quarter/Year need calendar arithmetic (setMonth/setFullYear),
        // which mutate their receiver — so operate on a copy and leave the
        // caller's `date` untouched, matching the other branches above.
        case DateInterval.Month: {
            const copy = new Date(date.getTime());
            copy.setMonth(copy.getMonth() + value);
            return copy;
        }
        case DateInterval.Quarter: {
            const copy = new Date(date.getTime());
            copy.setMonth(copy.getMonth() + value * 3);
            return copy;
        }
        case DateInterval.Year: {
            const copy = new Date(date.getTime());
            copy.setFullYear(copy.getFullYear() + value);
            return copy;
        }
    }
}

export function millsecondsToMinutes(ms: number): number {
    return ms / MILLISECONDS_PER_MINUTE;
}

/**
 * Displays the milliseconds as a human-readable string.
 * If the milliseconds are less than a minute, it returns "less than a minute".
 * It formats the output as "X days, Y hours, Z minutes".
 *
 * @param ms
 * @returns
 */
export function millisecondsToDayDisplay(ms: number): string {
    let displayStr = '';
    if (ms < MILLISECONDS_PER_MINUTE) {
        return 'less than a minute';
    }
    // start from days, then hours, then minutes
    if (ms >= MILLISECONDS_PER_DAY) {
        displayStr += `${Math.floor(ms / MILLISECONDS_PER_DAY)} days`;
        ms %= MILLISECONDS_PER_DAY;
    }
    if (ms >= MILLISECONDS_PER_HOUR) {
        if (displayStr.length > 0) {
            displayStr += ', ';
        }
        displayStr += `${Math.floor(ms / MILLISECONDS_PER_HOUR)} hours`;
        ms %= MILLISECONDS_PER_HOUR;
    }
    if (ms >= MILLISECONDS_PER_MINUTE) {
        if (displayStr.length > 0) {
            displayStr += ', ';
        }
        displayStr += `${Math.floor(ms / MILLISECONDS_PER_MINUTE)} minutes`;
        ms %= MILLISECONDS_PER_MINUTE;
    }
    return displayStr;
}

/**
 * Formats a Date to an ISO string with timezone offset.
 * The format is "yyyy-mm-ddThh:mm:ss.sss+|-hh:mm".
 * Example: "2023-10-01T12:00:00.000+02:00".
 *
 * @param date
 * @returns
 */
export function dateToISOStringWithTimezone(date: Date): string {
    const tzOffset = -date.getTimezoneOffset(); // Offset in minutes
    const diffSymbol = tzOffset >= 0 ? '+' : '-';
    const pad = (n: number) => `${Math.floor(Math.abs(n))}`.padStart(2, '0');

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const milliseconds = pad(date.getMilliseconds()).padStart(3, '0'); // Ensure 3 digits for milliseconds

    const offsetHours = pad(tzOffset / 60);
    const offsetMinutes = pad(tzOffset % 60);

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}${diffSymbol}${offsetHours}:${offsetMinutes}`;
}
