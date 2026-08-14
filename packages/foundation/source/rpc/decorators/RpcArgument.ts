// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Json } from '@system-inc/base-common/json/Json';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { TypeFunc } from '@system-inc/base-common/type/TypeFunc';
import { rpcMetadataAddArgument } from '../../internal/rpc/RpcMetadata';

export interface RpcArgumentOptions {
    /**
     * The name of the argument.
     * This is used for documentation purposes and can help with debugging.
     */
    name?: string;

    /**
     * Optional description for the argument.
     * This can be used for documentation purposes to explain the purpose of the argument.
     */
    description?: string;

    /**
     * Whether the argument is optional.
     *
     * If true, the argument is not required for the RPC call.
     * If false, the argument must be present in the RPC call
     * and will throw an error if missing.
     *
     * Defaults to false.
     */
    optional?: boolean;

    /**
     * Optional default value for the argument.
     *
     * This can be used to provide a default value
     * when the argument is not present in the RPC call.
     */
    defaultValue?: Json;
}

/**
 * Marks an argument of an `@Rpc` handler so the dispatcher can deserialize it
 * to the given type — and, for class types, validate it — before invoking the
 * handler.
 *
 * @param typeFunc The type to deserialize the argument to.
 * @param options Argument options such as `name`, `optional`, or
 * `defaultValue`.
 * @example
 * ```ts
 * @Rpc(() => ChargeResult)
 * async charge(
 *     @RpcArgument(() => ChargeInput) input: ChargeInput,
 *     @RpcArgument(() => Boolean, { optional: true }) dryRun?: boolean,
 * ): Promise<ChargeResult> { ... }
 * ```
 */
export function RpcArgument(
    typeFunc: TypeFunc,
    options?: RpcArgumentOptions,
): ParameterDecorator {
    return (
        target: object,
        propertyKey: string | symbol | undefined,
        parameterIndex: number,
    ) => {
        rpcMetadataAddArgument({
            serviceCtor: target.constructor as Constructor,
            handler: String(propertyKey),
            index: parameterIndex,
            typeFunc: typeFunc,
            options: options,
        });
    };
}
