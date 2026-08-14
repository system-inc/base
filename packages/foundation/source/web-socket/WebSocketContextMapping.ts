// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Json } from '@system-inc/base-common/json/Json';
import { RequestContextKey } from '../request/RequestContextKey';
import { WebSocketInfoKey } from './WebSocketInfoKey';

/**
 * A mapping from a {@link RequestContextKey} to a {@link WebSocketInfoKey}.
 *
 * Modules register these so the framework automatically copies per-request
 * values from the {@link RequestContext} into the {@link WebSocketInfo}
 * context bag at WebSocket connect time.
 *
 * Readers on the WebSocket side then pull the value back out with
 * `getWsContext(info, wsKey)`.
 *
 * @example
 * ```ts
 * // module setup
 * webSocket: {
 *     mappings: [
 *         { rcKey: DeviceIdRequestContextKey, wsKey: DeviceIdWebSocketInfoKey },
 *     ],
 * }
 * ```
 */
export interface WebSocketContextMapping<T extends Json = Json> {
    readonly rcKey: RequestContextKey<T>;
    readonly wsKey: WebSocketInfoKey<T>;
}
