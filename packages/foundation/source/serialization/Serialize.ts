// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Json, JsonObject } from '@system-inc/base-common/json/Json';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { isSerializable } from './interfaces/Serializable';
import { getSerializableMetadata } from './internal/SerializableMetadata';

export interface SerializeOptions {
    onCycle?: 'error' | 'omit' | 'null';
    replacer?: Parameters<JSON['stringify']>[1];
    space?: Parameters<JSON['stringify']>[2];
}

export function serialize<T extends object>(
    value: T,
    options?: SerializeOptions,
): Json;
export function serialize<T extends object>(
    value: ReadonlyArray<T>,
    options?: SerializeOptions,
): Json;
export function serialize(value: any, options: SerializeOptions = {}): Json {
    const result = _serialize(value, options, new WeakSet());
    if (result === undefined) {
        return null;
    }
    return result;
}

function _serialize(
    value: any,
    options: SerializeOptions,
    seen: WeakSet<any> = new WeakSet(),
): Json | undefined {
    if (value === null || value === undefined) {
        return value; // Return null or undefined as is.
    }

    if (typeof value !== 'object') {
        // make sure we have a JSON compatible primitive type
        if (
            typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean'
        ) {
            return value;
        } else {
            throw new TypeError(
                `Unsupported type for serialization: ${typeof value}`,
            );
        }
    }

    // Check for circular references using a WeakSet to track seen objects.
    const cyclePolicy = options.onCycle ?? 'error';
    if (seen.has(value)) {
        if (cyclePolicy === 'error') {
            throw new Error('Circular reference detected in serialization.');
        } else if (options.onCycle === 'omit') {
            return undefined; // Omit circular references.
        } else if (options.onCycle === 'null') {
            return null; // Replace circular references with null.
        }
    }
    seen.add(value);

    // If the value is serializable, use its serialize method instead of manual serialization.
    // This allows for custom serialization logic defined in the Serializable interface.
    if (isSerializable(value)) {
        return value.serialize(options);
    }

    // If the value is an array, serialize each item in the array.
    if (Array.isArray(value)) {
        return value
            .map((item) => _serialize(item, options, seen))
            .filter((item): item is Json => item !== undefined);
    }

    // Make sure we have a instance of a class with a constructor before proceeding.
    if (!('constructor' in value) || typeof value.constructor !== 'function') {
        throw new TypeError(
            'Value must be an instance of a class with a constructor.',
        );
    }
    const ctor = value.constructor as Constructor;

    const meta = getSerializableMetadata(ctor);
    if (!meta) {
        throw new Error(
            `No @SerializableObject metadata for ${value.constructor.name}`,
        );
    }

    const serializedObject: JsonObject = {};
    for (const field of meta.fields) {
        // Use the field's options name if provided, otherwise use the field's property name.
        const fieldName = field.options?.name ?? field.fieldName;

        // get the field value, taking into account default values and optional fields
        if (field.fieldName in value) {
            const fieldValue = value[field.fieldName];
            // If the field has a transformer, use it to serialize the value.
            if (field.options?.transformer) {
                const transformer = new field.options.transformer();
                serializedObject[fieldName] = transformer.toJson(fieldValue);
            } else if (field.typeFunc) {
                // If there's a type function, recursively serialize it.
                serializedObject[fieldName] = _serialize(
                    fieldValue,
                    options,
                    seen,
                );
            } else {
                // If no type function, pass through the value directly (raw object passthrough).
                serializedObject[fieldName] = fieldValue;
            }
        } else if (field.options && 'defaultValue' in field.options) {
            serializedObject[fieldName] = field.options.defaultValue;
        } else if (field.options?.optional) {
            serializedObject[fieldName] = undefined;
        } else {
            throw new Error(
                `Field ${field.fieldName} is required but not present in ${ctor.name}.`,
            );
        }
    }

    return serializedObject;
}
