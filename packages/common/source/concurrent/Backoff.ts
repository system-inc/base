// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { sleep } from './Sleep';

const DEFAULT_INITIAL_BACKOFF = 1000;
const DEFAULT_MAX_BACKOFF = 3 * 60 * 1000; // 3 minutes

export function backoffNext(
    attempt: number,
    minMs: number = DEFAULT_INITIAL_BACKOFF,
    maxMs: number = DEFAULT_MAX_BACKOFF,
    jitter: boolean = true,
): number {
    if (attempt < 1) {
        throw new Error('Attempt number must be at least 1.');
    }
    if (minMs > maxMs) {
        throw new Error(
            'Minimum delay must be less than or equal to maximum delay.',
        );
    }

    // Calculate exponential backoff time (2^attempt * min)
    let backoff = Math.min(minMs * Math.pow(2, attempt - 1), maxMs);

    // Apply jitter by randomizing between 50% and 100% of the backoff time
    if (jitter) {
        backoff = Math.floor(backoff * (0.5 + Math.random() * 0.5));
    }

    backoff = Math.min(Math.max(backoff, minMs), maxMs);

    return backoff;
}

/**
 * Awaits a promise for an exponentially increasing amount of time based
 * on the attempt number, with optional jitter.
 *
 * @param attempt The attempt number (starting at 1).
 * @param minMs The minimum delay (in milliseconds) default is 1000.
 * @param maxMs The maximum delay (in milliseconds) default is 3 minutes.
 * @param jitter Whether to apply jitter to the delay (default is true).
 * @returns
 */
export function backoff(
    attempt: number,
    minMs: number = DEFAULT_INITIAL_BACKOFF,
    maxMs: number = DEFAULT_MAX_BACKOFF,
    jitter: boolean = true,
): Promise<void> {
    return sleep(backoffNext(attempt, minMs, maxMs, jitter));
}
