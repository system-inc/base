// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Calculates the timezone offset in minutes for a given IANA timezone at a
 * specific point in time. Uses `Intl.DateTimeFormat` so DST transitions are
 * handled correctly. Shared by the dialect adapters' time-series bucketing.
 *
 * @param timeZone - IANA timezone string (e.g., 'America/New_York')
 * @param epochSec - Unix timestamp in seconds
 * @returns Offset in minutes, matching `Date.getTimezoneOffset()` convention
 *   (positive = behind UTC, negative = ahead of UTC)
 */
export function getTimezoneOffsetMinutes(
    timeZone: string,
    epochSec: number,
): number {
    const date = new Date(epochSec * 1000);

    // UTC time components
    const utcTime = Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
    );

    // Local time components in the target timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes): number => {
        const value = parts.find((candidate) => candidate.type === type)?.value;
        return value ? parseInt(value, 10) : 0;
    };
    const localTime = Date.UTC(
        part('year'),
        part('month') - 1,
        part('day'),
        part('hour'),
        part('minute'),
    );

    return (utcTime - localTime) / (1000 * 60);
}

export interface TimezoneOffsetSegment {
    /** Inclusive segment start (clamped to the queried range). */
    startEpochSec: number;
    /** Exclusive segment end. */
    endEpochSec: number;
    offsetMinutes: number;
}

/**
 * Splits `[startEpochSec, endEpochSec)` into segments of constant UTC
 * offset for the zone — one segment per side of each DST transition.
 * Bucketing with a single offset frozen at range start put every
 * post-transition row in the wrong local bucket for part of the day;
 * the adapters compile these segments into a per-row CASE instead.
 * Transition instants are located by bisection (to the minute), so a
 * multi-year range costs a handful of offset lookups per transition.
 */
export function getTimezoneOffsetSegments(
    timeZone: string,
    startEpochSec: number,
    endEpochSec: number,
): TimezoneOffsetSegment[] {
    const segments: TimezoneOffsetSegment[] = [];
    let cursor = startEpochSec;
    let cursorOffset = getTimezoneOffsetMinutes(timeZone, cursor);

    while (cursor < endEpochSec) {
        // Find the furthest point that still has the cursor's offset by
        // scanning forward in half-year steps (DST periods are months
        // long), then bisecting the first step that differs.
        let low = cursor;
        let high = endEpochSec;
        const step = 180 * 24 * 3600;
        let probe = Math.min(cursor + step, endEpochSec);
        while (
            probe < endEpochSec &&
            getTimezoneOffsetMinutes(timeZone, probe) === cursorOffset
        ) {
            low = probe;
            probe = Math.min(probe + step, endEpochSec);
        }
        if (getTimezoneOffsetMinutes(timeZone, probe) === cursorOffset) {
            // Constant to range end.
            segments.push({
                startEpochSec: cursor,
                endEpochSec,
                offsetMinutes: cursorOffset,
            });
            break;
        }
        high = probe;
        // Bisect to the transition minute: `low` has the old offset,
        // `high` the new one.
        while (high - low > 60) {
            let mid = Math.floor((low + high) / 2 / 60) * 60;
            if (mid <= low) {
                mid = low + 60;
            }
            if (getTimezoneOffsetMinutes(timeZone, mid) === cursorOffset) {
                low = mid;
            } else {
                high = mid;
            }
        }
        segments.push({
            startEpochSec: cursor,
            endEpochSec: high,
            offsetMinutes: cursorOffset,
        });
        cursor = high;
        cursorOffset = getTimezoneOffsetMinutes(timeZone, cursor);
    }
    return segments;
}
