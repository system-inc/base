// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Simple assert function.
 *
 * @param condition
 * @param message
 */
export function assert(condition: boolean, message?: string) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}
