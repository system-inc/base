// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { TypeFunc } from '@system-inc/base-common/type/TypeFunc';
import { SerializableFieldOptions } from '../decorators/SerializableField';

export interface SerializableFieldMetadata {
    fieldName: string;
    typeFunc?: TypeFunc;
    options?: SerializableFieldOptions;
}

export interface SerializableObjectMetadata {
    ctor: Constructor;
    fields: SerializableFieldMetadata[];
}

/**
 * Keyed by the *actual class* (constructor), so no string collisions.
 * Automatic GC when the class is unloaded (workers, tests, etc.).
 */
const META = new WeakMap<Constructor, SerializableObjectMetadata>();

/**
 * Registers `@SerializableObject()`
 */
export function addSerializableObjectMetadata(ctor: Constructor) {
    if (META.has(ctor)) {
        return; // Already registered
    }
    META.set(ctor, { ctor, fields: [] });
}

/**
 * Registers `@SerializableField()`
 */
export function addSerializableFieldMetadata(
    parentType: Constructor, // parent class (target.constructor)
    fieldName: string, // property name
    typeFunc?: TypeFunc, // () => SomeClass
    options?: SerializableFieldOptions,
) {
    let meta = META.get(parentType);
    if (!meta) {
        meta = { ctor: parentType, fields: [] };
        META.set(parentType, meta);
    }

    // Deduplicate (HMR / Jest-watch can re-evaluate files)
    if (!meta.fields.some((f) => f.fieldName === fieldName)) {
        meta.fields.push({
            fieldName: fieldName,
            typeFunc: typeFunc,
            options: options,
        });
    }
}

/**
 * Read-only accessor used by serialize/deserialize.
 *
 * Walks the prototype chain and merges inherited fields — field metadata
 * is keyed on the exact class whose decorator ran, so a subclass's own
 * entry holds only its own fields. Without the walk, `Child extends
 * Parent` silently dropped every inherited field on both serialize and
 * deserialize (including their required-field checks). A child
 * redeclaring a field overrides the parent's metadata — the same
 * contract `ValidationMetadata.getAllFor` implements.
 */
export function getSerializableMetadata(
    ctor: Constructor,
): Readonly<SerializableObjectMetadata> | undefined {
    const fieldsByName = new Map<string, SerializableFieldMetadata>();
    let found = false;
    let current: Constructor | null = ctor;
    while (current) {
        const meta = META.get(current);
        if (meta) {
            found = true;
            for (const field of meta.fields) {
                // Nearest declaration wins: fields already collected from
                // a more-derived class are not overwritten.
                if (!fieldsByName.has(field.fieldName)) {
                    fieldsByName.set(field.fieldName, field);
                }
            }
        }
        current = Object.getPrototypeOf(current) as Constructor | null;
    }
    return found ? { ctor, fields: [...fieldsByName.values()] } : undefined;
}
