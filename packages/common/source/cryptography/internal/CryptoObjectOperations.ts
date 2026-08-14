// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { utf8ToBytes } from '../../encoding/ByteEncoding';
import { Dictionary } from '../../type/Dictionary';

/**
 * Converts an object to a buffer.
 *
 * @param object
 * @returns
 */
export function objectToBuffer(
    object: Dictionary<unknown>,
): Uint8Array<ArrayBuffer> {
    if (typeof object !== 'object') {
        throw new Error('Invalid object');
    }
    if (object === null || object === undefined) {
        throw new Error('Invalid object');
    }
    const stringified = stringifyObject(object);
    return utf8ToBytes(stringified);
}

export function stringifyObject(object: Dictionary<unknown>): string {
    if (typeof object !== 'object') {
        throw new Error('Invalid object');
    }
    if (object === null) {
        return 'null';
    }
    return canonicalStringify(object);
}

/**
 * Produce an injective canonical string: distinct inputs always produce
 * distinct output. Keys are sorted for stability; values are JSON-encoded so
 * falsy values are distinguishable (0 / false / "" / null / undefined are all
 * distinct) and string content can't inject the structural delimiters. This
 * replaces an earlier `key:value;` form that rendered every falsy value as ""
 * and left ":" / ";" unescaped, so e.g. { a: 0 } / { a: false } / { a: "" }
 * and { a: "x;b:y" } / { a: "x", b: "y" } collided.
 */
function canonicalStringify(value: unknown): string {
    if (value === undefined) {
        return 'undefined';
    }
    if (value === null) {
        return 'null';
    }
    if (typeof value === 'bigint') {
        return `${value}n`;
    }
    if (typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map(canonicalStringify).join(',')}]`;
    }
    const record = value as Dictionary<unknown>;
    const entries = Object.keys(record)
        .sort()
        .map(
            (key) =>
                `${JSON.stringify(key)}:${canonicalStringify(record[key])}`,
        );
    return `{${entries.join(',')}}`;
}
