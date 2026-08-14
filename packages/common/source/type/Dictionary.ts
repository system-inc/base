// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * A dictionary type, which is a map from a string to a value of type T.
 */
export type Dictionary<T> = Record<string, T>;

/**
 * A partial dictionary type, which is a map from a string to an optional value of type T.
 */
export type PartialDictionary<T> = Partial<Record<string, T>>;

/**
 * A restricted dictionary type.
 * This only allows the keys in K, and the values are required.
 */
export type RestrictedDictionary<T, K extends string> = Record<K, T>;

/**
 * A partial restricted dictionary type.
 * This only allows the keys in K, and the values are optional.
 */
export type PartialRestrictedDictionary<T, K extends string> = Partial<
    Record<K, T>
>;

/**
 * Creates a new dictionary from the given object.
 *
 * @param obj
 * @returns
 */
export function dictionaryFrom<ValueType = unknown>(
    obj: object,
): Dictionary<ValueType> {
    return Object.fromEntries(Object.entries(obj));
}
