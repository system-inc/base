// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Json } from '@system-inc/base-common/json/Json';
import { TypedKey } from '@system-inc/base-common/type/TypedKey';

/**
 * A branded, typed key used to read and write values on a
 * {@link WebSocketInfo}'s context bag.
 *
 * Values must be JSON-serializable so they survive the wire transfer
 * that carries `WebSocketInfo` across workers / durable objects / RPC
 * message meta.
 *
 * Modules publish their own keys (e.g. device id, session id) and
 * applications publish their own domain-specific keys (e.g. a GridNode).
 * All of them share the same bag.
 *
 * Extends {@link TypedKey} with the `'web-socket-info'` scope brand so
 * WebSocket keys cannot be confused with request-context, environment,
 * or module keys at the type level.
 *
 * Two keys with the same `name` would collide on the shared context
 * bag and silently overwrite each other. {@link create} enforces
 * uniqueness at creation time and throws on duplicates. Namespace the
 * name (e.g. `'account:sessionId'`) so cross-module keys don't collide.
 */
export class WebSocketInfoKey<T extends Json> extends TypedKey<
    T,
    'web-socket-info'
> {
    /**
     * Creates a new {@link WebSocketInfoKey}.
     *
     * Throws if a `WebSocketInfoKey` with the same `name` has already
     * been created. The `name` should be namespaced
     * (e.g. `'account:sessionId'`) to avoid collisions with other
     * modules or app code writing to the same context bag.
     */
    static create<T extends Json>(name: string): WebSocketInfoKey<T> {
        if (registeredNames.has(name)) {
            throw new Error(
                `Duplicate WebSocketInfoKey "${name}". Two keys with the ` +
                    `same name would collide on the shared context bag and ` +
                    `silently overwrite each other's values. Namespace the ` +
                    `name (e.g. 'module:field') and define it once at ` +
                    `module scope.`,
            );
        }
        registeredNames.add(name);
        return new WebSocketInfoKey<T>(name);
    }
}

const registeredNames = new Set<string>();
