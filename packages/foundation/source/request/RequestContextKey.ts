// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { TypedKey } from '@system-inc/base-common/type/TypedKey';

/**
 * A branded key for type-safe extension storage on {@link RequestContext}.
 *
 * Modules create keys to store and retrieve per-request data without
 * stringly-typed lookups:
 *
 * ```ts
 * // Module defines the key
 * const DeviceId = RequestContextKey.create<string>('deviceId');
 *
 * // Middleware sets it
 * rc.set(DeviceId, '123');
 *
 * // Application reads it — fully typed
 * const id = rc.get(DeviceId); // string | undefined
 * ```
 *
 * Extends {@link TypedKey} with the `'request-context'` scope brand so
 * request-context keys cannot be confused with environment, module, or
 * WebSocket keys at the type level.
 *
 * Two keys with the same `name` would collide on the underlying
 * per-request Map and silently overwrite each other. {@link create}
 * enforces uniqueness at creation time and throws on duplicates, so
 * the failure surfaces at module load rather than as mysterious
 * read-wrong-value bugs at runtime. Define each key once at module
 * scope and import it where needed.
 */
export class RequestContextKey<T> extends TypedKey<T, 'request-context'> {
    /**
     * Creates a typed extension key for storing per-request data.
     *
     * Throws if a `RequestContextKey` with the same `name` has already
     * been created.
     *
     * @example
     * ```ts
     * const MyFlag = RequestContextKey.create<boolean>('myFlag');
     * rc.set(MyFlag, true);
     * rc.get(MyFlag); // boolean | undefined
     * ```
     */
    static create<T>(name: string): RequestContextKey<T> {
        if (registeredNames.has(name)) {
            throw new Error(
                `Duplicate RequestContextKey "${name}". Two keys with the ` +
                    `same name would collide on the per-request store and ` +
                    `silently overwrite each other's values. Define the ` +
                    `key once at module scope and import it where needed.`,
            );
        }
        registeredNames.add(name);
        return new RequestContextKey<T>(name);
    }
}

const registeredNames = new Set<string>();
