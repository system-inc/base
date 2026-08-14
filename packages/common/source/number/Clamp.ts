// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Returns a number whose value is limited to the given range.
 *
 * Example: limit the output of this computation to between 0 and 255
 * (x * 255).clamp(0, 255)
 *
 * @param value The value to clamp
 * @param min The minimum value
 * @param max The maximum value
 * @returns
 */
export function numberClamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}
