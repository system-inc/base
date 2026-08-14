// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Json } from '@system-inc/base-common/json/Json';
import { JsonValueTransformer } from '@system-inc/base-common/json/value-transformer/JsonValueTransformer';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { TypeFunc } from '@system-inc/base-common/type/TypeFunc';
import { addSerializableFieldMetadata } from '../internal/SerializableMetadata';

/**
 * Options for the `@SerializableField` decorator.
 */
export interface SerializableFieldOptions {
    /**
     * The name of the field in the serialized data.
     *
     * If not provided, the property name will be used.
     * This is useful for cases where the serialized field name differs from the property name.
     */
    name?: string;

    /**
     * Optional description for the field.
     *
     * This can be used for documentation purposes to explain the purpose of the field.
     */
    description?: string;

    /**
     * Whether the field is optional.
     *
     * If true, the field is not required for serialization/deserialization.
     * If false, the field must be present in the serialized data and will throw an error if missing.
     *
     * Defaults to false.
     */
    optional?: boolean;

    /**
     * Optional default value for the field.
     *
     * This can be used to provide a default value when the field is not present in the
     * serialized data.
     */
    defaultValue?: Json;

    /**
     * Optional transformer for custom serialization/deserialization.
     */
    transformer?: Constructor<JsonValueTransformer>;
}

/**
 * A field on a `@SerializableObject` class, included when instances are
 * serialized and deserialized. The type function tells the deserializer what
 * to construct for the property.
 *
 * @param typeFunc The type of the property.
 * @param options Field options such as `name`, `optional`, `defaultValue`, or
 * a custom `transformer`.
 * @example
 * ```ts
 * @SerializableField(() => String)
 * accountId: string;
 *
 * @SerializableField(() => Number, { optional: true })
 * amount?: number;
 * ```
 */
export function SerializableField(
    typeFunc?: TypeFunc,
    options?: SerializableFieldOptions,
): PropertyDecorator {
    return function (target: object, propertyKey: string | symbol) {
        addSerializableFieldMetadata(
            target.constructor as Constructor,
            propertyKey.toString(),
            typeFunc,
            options,
        );
    };
}
