// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { sleep } from './Sleep';

/**
 * Awaits a promise for a random amount of time between the specified
 * minimum and maximum values (in milliseconds).
 *
 * @param minMS
 * @param maxMs
 * @returns
 */
export function randomSleep(
    minMS: number = 100,
    maxMs: number = 10000,
): Promise<void> {
    const duration = Math.random() * (maxMs - minMS) + minMS;
    return sleep(duration);
}
