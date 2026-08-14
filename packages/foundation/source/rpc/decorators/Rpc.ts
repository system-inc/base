// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { TypeFunc } from '@system-inc/base-common/type/TypeFunc';
import { rpcMetadataAddHandler } from '../../internal/rpc/RpcMetadata';
import { RpcVisibility } from '../RpcVisibility';

export interface RpcOptions {
    /**
     * Optional visibility override for this procedure. Takes precedence
     * over the service-level (`@RpcService`) and worker-level
     * (`rpc.service` settings) visibility. `'internal'` — callable only
     * from bound workers; `'public'` — callable from the public route.
     * In local development mode everything is effectively `'public'`.
     */
    visibility?: RpcVisibility;
}

/**
 * Marks a method of an `@RpcService` class as a remote procedure, exposing it
 * to RPC clients. Arguments are described with `@RpcArgument` so the
 * dispatcher can deserialize and validate them.
 *
 * @param returnType - Optional return type of the RPC, used to serialize the
 * result.
 * @param options - Optional per-procedure options (e.g. a `visibility`
 * override).
 * @example
 * ```ts
 * @Rpc(() => String)
 * async echo(
 *     @RpcArgument(() => String) greeting: string,
 *     @RpcArgument(() => String) name: string,
 * ): Promise<string> {
 *     return `${greeting} ${name}`;
 * }
 * ```
 * @example
 * ```ts
 * // On an otherwise internal service, expose one procedure publicly.
 * @Rpc({ visibility: 'public' })
 * async healthCheck(): Promise<{ ok: boolean }> {
 *     return { ok: true };
 * }
 * ```
 */
export function Rpc(options: RpcOptions): MethodDecorator;
export function Rpc(
    returnType?: TypeFunc,
    options?: RpcOptions,
): MethodDecorator;
export function Rpc(
    returnTypeOrOptions?: TypeFunc | RpcOptions,
    options?: RpcOptions,
): MethodDecorator {
    const returnType =
        typeof returnTypeOrOptions === 'function'
            ? returnTypeOrOptions
            : undefined;
    const resolvedOptions =
        typeof returnTypeOrOptions === 'object' ? returnTypeOrOptions : options;
    return (
        target: object,
        propertyKey: string | symbol,
        _descriptor: PropertyDescriptor,
    ) => {
        rpcMetadataAddHandler({
            serviceCtor: target.constructor as Constructor,
            handlerName: propertyKey.toString(),
            returnType: returnType,
            options: resolvedOptions,
        });
    };
}
