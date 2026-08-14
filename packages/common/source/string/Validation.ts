// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Checks if a string contains any whitespace characters.
 *
 * @param inputString
 * @returns
 */
export function stringContainsWhitespace(inputString: string): boolean {
    // Use a regular expression to check for whitespace characters
    const whitespaceRegex = /\s/;

    // Test if the inputString contains any whitespace characters
    return whitespaceRegex.test(inputString);
}

/**
 * Check if a string contains only alphanumeric characters, hyphens, and dots.
 *
 * @param input
 * @returns
 */
export function stringIsAlphaNumericWithHyphens(input: string): boolean {
    const pattern = /^[a-zA-Z0-9.-]+$/;
    return pattern.test(input);
}
