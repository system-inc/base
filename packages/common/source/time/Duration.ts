// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { parse as parseDuration } from 'iso8601-duration';

export function dateFromDuration(
    durationString: string,
    anchor?: number,
): Date {
    const dur = parseDuration(durationString);
    const a = anchor !== undefined ? new Date(anchor) : new Date();

    // Rebuild the anchor as a UTC-based "calendar" point
    const d = new Date(
        Date.UTC(
            a.getUTCFullYear(),
            a.getUTCMonth(),
            a.getUTCDate(),
            a.getUTCHours(),
            a.getUTCMinutes(),
            a.getUTCSeconds(),
            a.getUTCMilliseconds(),
        ),
    );

    if (dur.years) {
        d.setUTCFullYear(d.getUTCFullYear() + dur.years);
    }
    if (dur.months) {
        d.setUTCMonth(d.getUTCMonth() + dur.months);
    }
    if (dur.weeks) {
        d.setUTCDate(d.getUTCDate() + dur.weeks * 7);
    }
    if (dur.days) {
        d.setUTCDate(d.getUTCDate() + dur.days);
    }
    if (dur.hours) {
        d.setUTCHours(d.getUTCHours() + dur.hours);
    }
    if (dur.minutes) {
        d.setUTCMinutes(d.getUTCMinutes() + dur.minutes);
    }
    if (dur.seconds) {
        d.setUTCSeconds(d.getUTCSeconds() + dur.seconds);
    }

    return d;
}
