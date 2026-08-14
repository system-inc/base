// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { JsonObject } from '@system-inc/base-common/json/Json';
import { SerializeOptions } from '../Serialize';

/**
 * Serializable interface defines a contract for objects that can be serialized
 * to a JSON object. This is useful for data transfer, storage, or any
 * scenario where a structured representation of an object is needed.
 */
export interface Serializable<T extends JsonObject = JsonObject> {
    /**
     * Serializes the current instance into a JSON compatible object.
     *
     * @param options Options for serialization, including access control and cycle handling.
     */
    serialize(options?: SerializeOptions): T;
}

/**
 * Determines if a value is serializable.
 *
 * @param value The value to check if it is serializable.
 * @returns Whether the value is serializable.
 */
export function isSerializable(value: unknown): value is Serializable {
    return (
        value !== null &&
        typeof value === 'object' &&
        'serialize' in value &&
        typeof value.serialize === 'function'
    );
}
