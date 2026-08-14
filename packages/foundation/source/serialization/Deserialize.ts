// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Json, JsonArray } from '@system-inc/base-common/json/Json';
import {
    Constructor,
    isConstructor,
} from '@system-inc/base-common/type/Constructor';
import { EnumLike, isEnumLike } from '@system-inc/base-common/type/EnumLike';
import {
    isPrimitiveType,
    primitiveTypeCreate,
} from '@system-inc/base-common/type/PrimitiveType';
import {
    TypeFunc,
    typeFuncUnwrap,
} from '@system-inc/base-common/type/TypeFunc';
import { ERROR_CODE_SERIALIZATION_ERROR } from '../error/ErrorCode';
import { HttpErrors } from '../error/HttpErrors';
import { isDeserializable } from './interfaces/Deserializable';
import { getSerializableMetadata } from './internal/SerializableMetadata';

export interface DeserializeOptions {
    strict?: boolean;
}

export function deserialize<T extends object>(
    raw: Json,
    to: Constructor<T> | EnumLike | TypeFunc<T>,
    options?: DeserializeOptions & { strict?: false },
): T | undefined;
export function deserialize<T extends object>(
    raw: Json,
    to: Constructor<T> | EnumLike | TypeFunc<T>,
    options?: DeserializeOptions & { strict: true },
): T;
export function deserialize<T extends object>(
    raw: JsonArray,
    to: Constructor<T> | EnumLike | TypeFunc<T>,
    options?: DeserializeOptions & { strict?: false },
): T[] | undefined;
export function deserialize<T extends object>(
    raw: JsonArray,
    to: Constructor<T> | EnumLike | TypeFunc<T>,
    options?: DeserializeOptions & { strict?: true },
): T[];
export function deserialize<T extends object>(
    raw: unknown,
    to: Constructor<T> | EnumLike | TypeFunc<T>,
    options: DeserializeOptions = {},
): T | undefined {
    const result = _deserialize(raw, to, options);
    if (result === undefined && options.strict) {
        throw HttpErrors.badRequest({
            message: `Deserialization failed for ${to.name}. The raw value is not compatible with the target type.`,
            errorCode: ERROR_CODE_SERIALIZATION_ERROR,
        });
    }
    return result;
}

function _deserialize(
    raw: any,
    to: Constructor | EnumLike | TypeFunc,
    options: DeserializeOptions,
): any {
    if (raw === null || raw === undefined) {
        return raw;
    }

    const info = getDeserializationInfo(raw, to);

    if (info.isArray) {
        if (Array.isArray(raw)) {
            return raw.map((v) => _deserialize(v, info.ctor, options));
        } else {
            return undefined; // If raw is not an array, return undefined.
        }
    }

    // if the raw value is an enum value, we can return it directly
    if (info.serializableType === 'enum') {
        if (typeof raw === 'string' || typeof raw === 'number') {
            if (!Object.values(info.ctor).includes(raw)) {
                throw HttpErrors.badRequest({
                    message: `Invalid enum value: ${raw} for enum ${info.ctor.name}.`,
                    errorCode: ERROR_CODE_SERIALIZATION_ERROR,
                });
            }
            return raw; // Return the enum value directly.
        }
        throw HttpErrors.badRequest({
            message: `Invalid raw value for enum deserialization: ${raw}. Expected a string or number.`,
            errorCode: ERROR_CODE_SERIALIZATION_ERROR,
        });
    }

    // if the raw value is a constructor, lets try to get the metadata
    const meta = getSerializableMetadata(info.ctor);
    if (!meta) {
        // if we have a system type, we can return the raw value directly
        if (isPrimitiveType(info.ctor)) {
            return primitiveTypeCreate(info.ctor, raw);
        }

        // if strict mode is enabled, throw an error
        if (options.strict) {
            throw new Error(
                `No @SerializableObject metadata for ${info.ctor.name}`,
            );
        }

        // no metadata, no problem, return undefined
        // we don't want to deserialize fields that are not defined in the metadata
        return undefined;
    }

    // Create a new instance of the class
    const typeInstance: any = new info.ctor();

    // If the class implements Deserializable, use its deserialize method.
    if (isDeserializable(typeInstance)) {
        return typeInstance.deserialize(raw, options);
    }

    // Otherwise, we will manually deserialize the fields based on the metadata.
    for (const field of meta.fields) {
        // Use the field's options name if provided, otherwise use the field's property name.
        const fieldName = field.options?.name ?? field.fieldName;

        // Perform the checks if the field isn't in the raw data
        if (fieldName in raw) {
            const rawValue = raw[fieldName];
            const deserializedValue = field.options?.transformer
                ? new field.options.transformer().fromJson(rawValue)
                : field.typeFunc
                  ? _deserialize(rawValue, field.typeFunc, options)
                  : rawValue;
            typeInstance[field.fieldName] = deserializedValue;
        } else {
            // These branches write to the PROPERTY name (field.fieldName),
            // matching the present-field branch above — `fieldName` here is
            // the wire name, which for a renamed field would stamp the
            // default onto a junk property and leave the real one unset.
            if (field.options && 'defaultValue' in field.options) {
                // If a default value is provided, use it.
                typeInstance[field.fieldName] = field.options.defaultValue;
            } else if (field.options?.optional) {
                // If the field is optional, set it to undefined.
                typeInstance[field.fieldName] = undefined;
            } else {
                // If the field is required and not present, throw an error.
                throw HttpErrors.badRequest({
                    message: `Missing required field '${fieldName}' in raw data for ${to.name}`,
                    errorCode: ERROR_CODE_SERIALIZATION_ERROR,
                });
            }
        }
    }

    return typeInstance;
}

function getDeserializationInfo(
    raw: any,
    to: Constructor | EnumLike | TypeFunc,
): DeserializationInfo {
    if (isConstructor(to)) {
        return {
            serializableType: 'constructor',
            isArray: Array.isArray(raw),
            ctor: to,
        };
    } else if (isEnumLike(to)) {
        return {
            serializableType: 'enum',
            isArray: Array.isArray(raw),
            ctor: to,
        };
    } else {
        const ctor = typeFuncUnwrap(to);
        const isArray = Array.isArray(to());
        if (isConstructor(ctor)) {
            return {
                serializableType: 'constructor',
                isArray,
                ctor,
            };
        } else {
            return {
                serializableType: 'enum',
                isArray,
                ctor,
            };
        }
    }
}

type DeserializationInfo =
    | {
          serializableType: 'constructor';
          isArray: boolean;
          ctor: Constructor;
      }
    | {
          serializableType: 'enum';
          isArray: boolean;
          ctor: EnumLike;
      };
