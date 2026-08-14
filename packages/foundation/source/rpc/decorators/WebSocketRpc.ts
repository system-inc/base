// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { TypedMethodDecorator } from '@system-inc/base-common/type/UtilityTypes';
import { rpcMetadataAddHandler } from '../../internal/rpc/RpcMetadata';

/**
 * Marks a method as a remote procedure callable only over a WebSocket.
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
        });
    };
}
