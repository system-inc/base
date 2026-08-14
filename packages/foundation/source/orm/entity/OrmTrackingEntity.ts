// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { Dictionary } from '@system-inc/base-common/type/Dictionary';
import { OrmAfterInsert } from '../decorators/OrmAfterInsert';
import { OrmAfterLoad } from '../decorators/OrmAfterLoad';
import { OrmAfterUpdate } from '../decorators/OrmAfterUpdate';
import { OrmPartialEntity } from '../interfaces/OrmPartialEntity';
import { ormRequireTable } from '../metadata/OrmSchemaRegistry';

/**
 * Classes whose prototypes already carry the column accessors. Accessors
 * are installed once per class on first construction — NOT once per
 * instance: per-instance `Object.defineProperty` was the single largest
 * cost of hydrating a row (~70% of construct-plus-assign, measured on a
 * 100-row list query), and per-instance accessors also defeat V8's
 * hidden-class sharing across instances of the same entity.
 */
const accessorInstalledClasses = new WeakSet<object>();

/**
 * A base class for entities that tracks changes to fields.
 */
export abstract class OrmTrackingEntity {
    /**
     * Create a new instance of the entity with the given data.
     *
     * @param this
     * @param data
     * @returns
     */
    static from<T extends OrmTrackingEntity>(
        this: new () => T,
        data: OrmPartialEntity<T>,
    ): T {
        const o = new this();
        for (const [key, value] of Object.entries(data)) {
            (o as any)[key] = value;
        }
        return o;
    }

    private _changedFields: Set<string> = new Set();

    constructor() {
        this._createPropertyAccessors();
    }

    protected markChanged(field: string) {
        this._changedFields.add(field);
    }

    getChangedFields(): OrmPartialEntity<this> {
        const changed: Dictionary<unknown> = {};
        for (const field of this._changedFields) {
            changed[field] = (this as any)[field];
        }
        return changed as OrmPartialEntity<this>;
    }

    protected clearChangedFields() {
        this._changedFields.clear();
    }

    clone<T extends this>(): T {
        const clone = Object.create(this.constructor.prototype);
        // Initialize the changed fields set
        clone._changedFields = new Set<string>();
        // Ensure the class's prototype accessors exist — a no-op unless
        // this clone is somehow the first instance of the class ever made.
        clone._createPropertyAccessors();

        // Copy all field values including columns and custom properties
        const metadata = ormRequireTable(this.constructor as Constructor);

        // Copy column values via private keys
        for (const column of metadata.columns) {
            const privateKey = `__${column.propertyKey}`;
            if (privateKey in this) {
                clone[privateKey] = (this as any)[privateKey];
            }
        }

        // Copy relation values
        for (const relation of metadata.relations) {
            const value = (this as any)[relation.propertyKey];
            if (value !== undefined) {
                clone[relation.propertyKey] = value;
            }
        }

        // Copy any additional properties
        for (const key in this) {
            // Skip internal fields and already copied fields
            if (key.startsWith('_') || key.startsWith('__')) {
                continue;
            }

            // Skip if already handled as column or relation
            const isColumnOrRelation =
                metadata.columns.some((c) => c.propertyKey === key) ||
                metadata.relations.some((r) => r.propertyKey === key);
            if (isColumnOrRelation) {
                continue;
            }

            // Copy the property if it's enumerable
            const descriptor = Object.getOwnPropertyDescriptor(this, key);
            if (descriptor && descriptor.enumerable) {
                clone[key] = (this as any)[key];
            }
        }

        // Clear any tracked changes
        clone.clearChangedFields();
        return clone;
    }

    toJSON(options?: { strict?: boolean }) {
        const visited = new WeakSet();
        return this._serialize(visited, options?.strict);
    }

    @OrmAfterLoad()
    protected afterLoad() {
        this.clearChangedFields();
    }

    @OrmAfterInsert()
    @OrmAfterUpdate()
    protected afterSave() {
        this.clearChangedFields();
    }

    private _createPropertyAccessors() {
        const ctor = this.constructor;
        if (accessorInstalledClasses.has(ctor)) {
            return;
        }

        // Defined on the concrete class's PROTOTYPE, shared by every
        // instance: the accessors never reference a captured instance —
        // they read `this.__<field>` — so per-instance copies bought
        // nothing but construction cost. The merged metadata includes
        // inherited columns, so a subclass's prototype gets the full set
        // (shadowing any the base class installed). This is also why
        // decorated columns must use `declare`: an emitted class-field
        // initializer would define an own data property over these.
        const metadata = ormRequireTable(ctor as Constructor);
        const prototype = ctor.prototype as Record<string, unknown>;

        for (const field of metadata.columns) {
            const fieldKey = field.propertyKey;
            const privateKey = `__${fieldKey}`;

            Object.defineProperty(prototype, fieldKey, {
                get() {
                    return this[privateKey];
                },
                set(value: unknown) {
                    const oldValue = this[privateKey];
                    this[privateKey] = value;
                    if (!isEqual(oldValue, value)) {
                        this.markChanged(fieldKey);
                    }
                },
                enumerable: true,
                configurable: true,
            });
        }

        accessorInstalledClasses.add(ctor);
    }

    private _serialize(
        visited: WeakSet<object>,
        strict?: boolean,
    ): Dictionary<unknown> {
        // Prevent circular reference infinite loops
        if (visited.has(this)) {
            if (strict) {
                throw new Error(
                    'Circular reference detected during JSON serialization',
                );
            }
            // Skip this object to avoid infinite recursion
            return undefined as any;
        }

        visited.add(this);

        const metadata = ormRequireTable(this.constructor as Constructor);
        const result: Dictionary<unknown> = {};

        // Add all column values. Primitives (the overwhelming majority of
        // column values) skip the dispatch — this loop runs per column per
        // row on every serialized list response.
        for (const column of metadata.columns) {
            const value = (this as any)[column.propertyKey];
            result[column.propertyKey] =
                value === null || typeof value !== 'object'
                    ? value
                    : this._serializeValue(value, visited, strict);
        }

        // Add all relation values
        for (const relation of metadata.relations) {
            const value = (this as any)[relation.propertyKey];
            // Only include if the relation is loaded (not undefined)
            if (value !== undefined) {
                const serialized = this._serializeValue(value, visited, strict);
                // Only add if not undefined (could be undefined from circular reference)
                if (serialized !== undefined) {
                    result[relation.propertyKey] = serialized;
                }
            }
        }

        // Add any additional enumerable OWN properties that aren't internal
        // fields — custom properties added to the instance. `Object.keys`
        // is exactly that set (the accessors live on the prototype, so
        // columns never appear here), and it avoids the per-key
        // `getOwnPropertyDescriptor` a `for..in` walk needed.
        for (const key of Object.keys(this)) {
            // Skip internal tracking fields and private column stashes
            if (key.startsWith('_')) {
                continue;
            }

            // Skip if already added as column or relation
            if (Object.prototype.hasOwnProperty.call(result, key)) {
                continue;
            }

            const value = (this as any)[key];
            result[key] =
                value === null || typeof value !== 'object'
                    ? value
                    : this._serializeValue(value, visited, strict);
        }

        return result;
    }

    private _serializeValue(
        value: unknown,
        visited: WeakSet<object>,
        strict?: boolean,
    ): unknown {
        // Handle arrays - serialize each item
        if (Array.isArray(value)) {
            return value
                .map((item) => this._serializeValue(item, visited, strict))
                .filter((item) => item !== undefined); // Remove undefined items from circular refs
        }

        // Handle objects with toJSON method (including other OrmTrackingEntity instances)
        if (
            value &&
            typeof value === 'object' &&
            'toJSON' in value &&
            typeof value.toJSON === 'function'
        ) {
            // For OrmTrackingEntity, pass the visited set
            if (value instanceof OrmTrackingEntity) {
                return value._serialize(visited, strict);
            }
            // For other objects with toJSON, just call it
            return value.toJSON();
        }

        // Return primitive values and other objects as-is
        return value;
    }
}

function isEqual(a: unknown, b: unknown): boolean {
    if (a === b) {
        return true;
    }
    if (a == null || b == null) {
        return false;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) {
            return false;
        }
        return a.every((v, i) => v === b[i]);
    }
    return false;
}
