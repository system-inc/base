// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { LANGUAGE_CODE_US } from '../locale/LanguageCode';
import { LocaleOptions } from '../locale/LocaleOptions';

/**
 * Format a date in short format
 * Example: "1/1/2025" for 'en-US' locale
 */
export function formatDateShort(date: Date, options?: LocaleOptions): string {
    return new Date(date).toLocaleDateString(
        options?.languageCode ?? LANGUAGE_CODE_US,
        {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
            timeZone: options?.timezone,
        },
    );
}

/**
 * Format a date in long format
 * Example: "Wednesday, January 1, 2025" for 'en-US' locale
 */
export function formatDateLong(date: Date, options?: LocaleOptions): string {
    return new Date(date).toLocaleDateString(
        options?.languageCode ?? LANGUAGE_CODE_US,
        {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: options?.timezone,
        },
    );
}

/**
 * Format month in long format
 * Example: "January 2025" for 'en-US' locale
 */
export function formatDateMonth(date: Date, options?: LocaleOptions): string {
    return new Date(date).toLocaleDateString(
        options?.languageCode ?? LANGUAGE_CODE_US,
        {
            month: 'long',
            year: 'numeric',
            timeZone: options?.timezone,
        },
    );
}

/**
 * Format a timestamp in long format
 * Example: "Wednesday, January 1, 2025 at 12:00:00 AM" for 'en-US' locale
 */
export function formatDateTimestamp(
    date: Date,
    options?: LocaleOptions,
): string {
    return new Date(date).toLocaleDateString(
        options?.languageCode ?? LANGUAGE_CODE_US,
        {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            timeZoneName: 'short',
            timeZone: options?.timezone,
        },
    );
}

/**
 * Format a date in short MM/YY format
 * Example: "11/25" for 'en-US' locale
 */
export function formatDateMonthYear(
    date: Date,
    options?: LocaleOptions,
): string {
    return new Date(date).toLocaleDateString(
        options?.languageCode ?? LANGUAGE_CODE_US,
        {
            month: '2-digit',
            year: '2-digit',
            timeZone: options?.timezone,
        },
    );
}

/**
 * Format a date as a version timestamp for cache-busting query parameters.
 * Example: "2026-03-05-14-32-08"
 */
export function formatDateVersion(date: Date): string {
    return date
        .toISOString()
        .replace('T', '-')
        .replace(/[:]/g, '-')
        .replace(/\.\d{3}Z$/, '');
}
