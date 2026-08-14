// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { JsonObject } from '@system-inc/base-common/json/Json';
import { DeserializeOptions } from '../Deserialize';

/**
 * Deserializable interface defines a contract for objects that can be deserialized from JSON.
 * This is useful for reconstructing objects from a structured JSON representation.
 */
export interface Deserializable {
    /**
     * Hydrates the current instance from a raw JSON object.
     *
     * @param raw The raw JSON object to deserialize.
     * @param options Any options for deserialization, such as strict mode or access control.
     * @return The deserialized instance of the object.
     */
    deserialize(raw: JsonObject, options?: DeserializeOptions): this;
}

/**
 * Determines if a value is deserializable.
 *
 * @param value The value to check if it is deserializable.
 * @returns Whether the value is deserializable.
 */
export function isDeserializable(value: unknown): value is Deserializable {
    return (
        value !== null &&
        typeof value === 'object' &&
        'deserialize' in value &&
        typeof value.deserialize === 'function'
    );
}
