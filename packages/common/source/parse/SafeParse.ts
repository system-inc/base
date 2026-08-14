// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Safely parses an unknown value to a number.
 * Returns the default value if parsing fails or the value is null/undefined.
 *
 * @param value - The value to parse
 * @param defaultValue - The default value to return if parsing fails
 * @returns The parsed number or the default value
 */
export function safeParseNumber(value: unknown, defaultValue: number): number {
    if (value == null) {
        return defaultValue;
    }
    if (typeof value === 'number') {
        return isNaN(value) ? defaultValue : value;
    }
    if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? defaultValue : parsed;
    }
    return defaultValue;
}

/**
 * Safely parses an unknown value to an integer.
 * Returns the default value if parsing fails or the value is null/undefined.
 *
 * @param value - The value to parse
 * @param defaultValue - The default value to return if parsing fails
 * @returns The parsed integer or the default value
 */
export function safeParseInt(value: unknown, defaultValue: number): number {
    if (value == null) {
        return defaultValue;
    }
    if (typeof value === 'number') {
        return isNaN(value) ? defaultValue : Math.floor(value);
    }
    if (typeof value === 'string') {
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? defaultValue : parsed;
    }
    return defaultValue;
}

/**
 * Safely parses an unknown value to a Date.
 * Returns undefined if parsing fails or the value is null/undefined.
 *
 * @param value - The value to parse
 * @returns The parsed Date or undefined
 */
export function safeParseDate(value: unknown): Date | undefined {
    if (value == null) {
        return undefined;
    }
    if (value instanceof Date) {
        return isNaN(value.getTime()) ? undefined : value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? undefined : date;
    }
    return undefined;
}

/**
 * Safely parses an unknown value to a string.
 * Returns the default value if the value is null/undefined or not a string.
 *
 * @param value - The value to parse
 * @param defaultValue - The default value to return if parsing fails
 * @returns The string value or the default value
 */
export function safeParseString(value: unknown, defaultValue: string): string {
    if (value == null) {
        return defaultValue;
    }
    if (typeof value === 'string') {
        return value;
    }
    return defaultValue;
}

/**
 * Safely parses an unknown value to a string or null.
 * Returns null if the value is null/undefined or not a string.
 *
 * @param value - The value to parse
 * @returns The string value or null
 */
export function safeParseStringOrNull(value: unknown): string | null {
    if (value == null) {
        return null;
    }
    if (typeof value === 'string') {
        return value;
    }
    return null;
}

/**
 * Safely parses an unknown value to a boolean.
 * Returns the default value if the value is null/undefined.
 * Handles string values like "true", "false", "1", "0".
 *
 * @param value - The value to parse
 * @param defaultValue - The default value to return if parsing fails
 * @returns The boolean value or the default value
 */
export function safeParseBoolean(
    value: unknown,
    defaultValue: boolean,
): boolean {
    if (value == null) {
        return defaultValue;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (lower === 'true' || lower === '1') {
            return true;
        }
        if (lower === 'false' || lower === '0') {
            return false;
        }
    }
    return defaultValue;
}

/**
 * Safely parses an unknown value to an enum value.
 * Returns the default value if the value is not a valid enum member.
 *
 * @param enumObj - The enum object to validate against
 * @param value - The value to parse
 * @param defaultValue - The default value to return if parsing fails
 * @returns The enum value or the default value
 */
export function safeParseEnum<T extends string>(
    enumObj: Record<string, T>,
    value: unknown,
    defaultValue: T,
): T {
    if (value == null) {
        return defaultValue;
    }
    if (typeof value === 'string') {
        const enumValues = Object.values(enumObj);
        if (enumValues.includes(value as T)) {
            return value as T;
        }
    }
    return defaultValue;
}
