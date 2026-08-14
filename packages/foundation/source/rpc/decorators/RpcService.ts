// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { DecoratorRegistry } from '@system-inc/base-common/decorator/DecoratorRegistry';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { rpcMetadataAddService } from '../../internal/rpc/RpcMetadata';
import { RpcVisibility } from '../RpcVisibility';

export const RpcServiceDecoratorName = 'RpcService';

export interface RpcServiceOptions {
    visibility?: RpcVisibility;
}

/**
 * Marks a class as a remote procedure service, allowing it to expose methods
 * as RPCs via the `@Rpc` decorator.
 *
 * List the class in a module's (or the worker's) `services`. Visibility
 * defaults to `'internal'` — callable only from bound workers; use
 * `'public'` to expose the service on a public route.
 *
 * @param options Service options such as `visibility`.
 * @example
 * ```ts
 * @RpcService({ visibility: 'internal' })
 * export class BillingRpcService {
 *     @Rpc(() => ChargeResult)
 *     async charge(
 *         @RpcArgument(() => ChargeInput) input: ChargeInput,
 *     ): Promise<ChargeResult> { ... }
 * }
 * ```
 */
export function RpcService(options?: RpcServiceOptions): ClassDecorator {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    return (target: Function) => {
        const ctor = target as Constructor<object>;
        DecoratorRegistry.get().mark(ctor, RpcServiceDecoratorName);
        rpcMetadataAddService({
            serviceCtor: ctor,
            options: options,
        });
    };
}
