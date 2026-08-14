// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { LogCategory } from '../logging/LogCategory';
import { Logger } from '../logging/Logger';

/**
 * Awaits a promise for a specified amount of time (in milliseconds).
 * If a callback is provided, it will be executed after the delay.
 *
 * @param milliseconds - The duration to sleep in milliseconds.
 * @param callback - An optional callback function to execute after sleeping.
 * @returns A promise that resolves after the specified duration.
 */
export function sleep(
    milliseconds: number,
    callback?: () => void,
): Promise<void> {
    return new Promise((resolve) =>
        setTimeout(() => {
            if (callback) {
                try {
                    callback();
                } catch (error) {
                    Logger.error(LogCategory.Common, 'Sleep error:', error);
                }
            }
            resolve();
        }, milliseconds),
    );
}
