// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Dictionary } from '../type/Dictionary';

/**
 * The key used to access the default config in a named config.
 */
export const DefaultConfigurationKey = '@default';

/**
 * A dictionary for providing configuration information per named key.
 * E.g. You could use this to define settings that are specific to different environments.
 * You can use `@default` to define a default value that will be used
 * if no specific key value is found.
 */
export type NamedConfiguration<T> = Dictionary<T | undefined> & {
    [DefaultConfigurationKey]?: T;
};

/**
 * Get the value for the specified key.
 * If the key is not found, return the default value.
 * If the default value is not specified, return undefined.
 *
 * @param configuration
 * @param key
 * @param defaultValue
 * @returns
 */
export function namedConfigurationGetValue<T>(
    configuration: NamedConfiguration<T>,
    key: string,
): T | undefined;
export function namedConfigurationGetValue<T>(
    configuration: NamedConfiguration<T>,
    key: string,
    defaultValue: T,
): T;
export function namedConfigurationGetValue<T>(
    configuration: NamedConfiguration<T>,
    key: string,
    defaultValue?: T,
): T | undefined {
    const specifiedDefaultValue = configuration[DefaultConfigurationKey];
    const keyValue = configuration[key];

    // prefer a specified key value if one exists, otherwise use programmatic default
    if (keyValue !== undefined) {
        return keyValue;
    } else if (specifiedDefaultValue !== undefined) {
        return specifiedDefaultValue;
    }

    // If the key value is not found, return the default value
    return defaultValue as T;
}
