// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Lowercases the first letter of a string.
 *
 * @param str
 * @returns
 */
export function stringLowercaseFirstLetter(str: string): string {
    if (str.length === 0) {
        return str; // Return unchanged if the string is empty
    } else {
        const firstLetterLowercase = str[0].toLowerCase(); // Convert the first letter to lowercase
        return firstLetterLowercase + str.slice(1); // Concatenate the modified first letter with the rest of the string
    }
}

/**
 * Converts a string to title case.
 * eg. "hello world" -> "Hello World"
 * @param input
 * @returns
 */
export function stringToTitleCase(input: string): string {
    // Split the input string into words
    const words = input.split(' ');

    // Capitalize the first letter of each word
    const capitalizedWords = words.map((word) => {
        return word.charAt(0).toUpperCase() + word.slice(1);
    });

    // Join the words back together
    return capitalizedWords.join(' ');
}

/**
 * Converts a CamelCase string to kebab-case.
 * @param input
 * @returns
 */
export function stringCamelToKebab(input: string): string {
    return input.replace(/(?!^)([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Converts a string to uppercase with underscores.
 * eg. "hello world" -> "HELLO_WORLD"
 *
 * @param input
 * @returns
 */
export function stringToCapsAndUnderscores(input: string): string {
    return input
        .replace(/([a-z])([A-Z])/g, '$1_$2') // Insert _ between camelCase
        .replace(/[\s-]+/g, '_') // Replace spaces and hyphens with underscores
        .toUpperCase(); // Convert to uppercase
}
