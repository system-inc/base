// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Time intervals for grouping time series data.
 *
 * Intervals come in two categories:
 * - **Specific intervals**: Include full date/time context (Minute, Hour, Day, Month, Quarter, Year)
 * - **Aggregating intervals**: Extract only a portion of the date (HourOfDay, DayOfWeek, DayOfMonth, MonthOfYear)
 *
 * Aggregating intervals are useful for pattern analysis across time periods
 * (e.g., "traffic by hour of day" or "sales by day of week").
 */
export enum TimeInterval {
    /**
     * Specific minute with full date and time (e.g., "2024-01-15 14:30:00")
     */
    Minute = 'Minute',

    /**
     * Specific hour with full date (e.g., "2024-01-15 14:00:00")
     */
    Hour = 'Hour',

    /**
     * Hour of day only, 0-23 (e.g., "14" for 2pm, aggregates across all dates)
     */
    HourOfDay = 'HourOfDay',

    /**
     * Specific calendar day (e.g., "2024-01-15")
     */
    Day = 'Day',

    /**
     * Day of week only, 0-6 where 0=Sunday (e.g., "3" for Wednesday, aggregates across all weeks)
     */
    DayOfWeek = 'DayOfWeek',

    /**
     * Specific week with year (e.g., "2024-03" for week 3 of 2024)
     */
    Week = 'Week',

    /**
     * Week of year only, 0-53 (e.g., "03" for week 3, aggregates across all years)
     */
    WeekOfYear = 'WeekOfYear',

    /**
     * Day of month only, 1-31 (e.g., "15" for the 15th, aggregates across all months)
     */
    DayOfMonth = 'DayOfMonth',

    /**
     * Specific year-month (e.g., "2024-01" for January 2024)
     */
    Month = 'Month',

    /**
     * Month of year only, 1-12 (e.g., "01" for January, aggregates across all years)
     */
    MonthOfYear = 'MonthOfYear',

    /**
     * Specific year-quarter (e.g., "2024-Q1" for Q1 2024)
     */
    Quarter = 'Quarter',

    /**
     * Specific year (e.g., "2024")
     */
    Year = 'Year',
}

export function timeIntervalToDateFormat(interval: TimeInterval): string {
    let dateFormat = `%Y-%m-%d`;
    switch (interval) {
        case TimeInterval.Minute:
            dateFormat = `%Y-%m-%dT%H:%M:00Z`;
            break;
        case TimeInterval.Hour:
            dateFormat = `%Y-%m-%dT%H:00:00Z`;
            break;
        case TimeInterval.HourOfDay:
            dateFormat = `%H`;
            break;
        case TimeInterval.Day:
            dateFormat = `%Y-%m-%d`;
            break;
        case TimeInterval.DayOfWeek:
            dateFormat = `%w`;
            break;
        case TimeInterval.Week:
            dateFormat = `%Y-%v`;
            break;
        case TimeInterval.WeekOfYear:
            dateFormat = `%v`;
            break;
        case TimeInterval.DayOfMonth:
            dateFormat = `%d`;
            break;
        case TimeInterval.Month:
            dateFormat = `%Y-%m`;
            break;
        case TimeInterval.MonthOfYear:
            dateFormat = `%m`;
            break;
        case TimeInterval.Quarter:
            // quarter is special, we would use QUARTER directly
            dateFormat = `%Y-%M`;
            break;
        case TimeInterval.Year:
            dateFormat = `%Y`;
            break;
    }
    return dateFormat;
}
