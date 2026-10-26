// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { TypedMethodDecorator } from '@system-inc/base-common/type/UtilityTypes';
import { rpcMetadataAddHandler } from '../../internal/rpc/RpcMetadata';

/**
 * Marks a method as a remote procedure callable only over a WebSocket.
 *
 * A client invokes it by sending `{ type: '<method name>', arguments: [...] }`
 * on a socket whose delegate doesn't override `onWebSocketEvent`. The
 * dispatcher enforces socket-only access at runtime: an HTTP call to the
 * procedure is rejected, and it's the only kind of non-`'public'`
 * procedure a socket client can reach — `'internal'` procedures never
 * accept socket callers.
 *
 * WebSocket procedures are fire-and-forget from the caller's perspective —
 * the return type is constrained to `Promise<void>`.
 *
 * @example
 * ```ts
 * @WebSocketRpc()
 * async subscribe(@RpcArgument(() => String) topic: string): Promise<void> { ... }
 * ```
 */
export function WebSocketRpc<
    T extends (...args: any[]) => Promise<void>,
>(): TypedMethodDecorator<T> {
    return (
        target: object,
        propertyKey: string | symbol,
        _descriptor: TypedPropertyDescriptor<T>,
    ) => {
        rpcMetadataAddHandler({
            serviceCtor: target.constructor as Constructor,
            handlerName: propertyKey.toString(),
            webSocket: true,
        });
    };
}
