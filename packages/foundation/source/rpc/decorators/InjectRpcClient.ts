// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-explicit-any */

import { InjectionToken, injectWithTransform } from 'tsyringe';

import { RpcClient } from '@system-inc/base-client/rpc/client/RpcClient';
import { InjectionTransform } from '../../dependency-injection/InjectionTransform';
import { TypedParameterDecorator } from '../../dependency-injection/TypedParameterDecorator';
import { RpcClientFactory } from '../client/RpcClientFactory';
import { RpcClientBinding } from '../RpcClientBinding';

/**
 * Injects an RpcClient bound to the service declared by the given
 * `RpcClientBinding<RpcInterface>`. The binding's name matches a client entry
 * in the worker's `rpc.client` settings (typically a Cloudflare service
 * binding), and its generic threads the remote service's type through so
 * calls are fully typed.
 *
 * @param service The binding identifying the remote service.
 * @example
 * ```ts
 * export class WorkerBindings {
 *     static readonly Billing = new RpcClientBinding<BillingRpcService>('BILLING');
 * }
 *
 * @Injectable()
 * export class CheckoutService {
 *     constructor(
 *         @InjectRpcClient(WorkerBindings.Billing)
 *         private billing: RpcClient<BillingRpcService>,
 *     ) {}
 *
 *     async charge(input: ChargeInput): Promise<ChargeResult> {
 *         return await this.billing.call().charge(input);
 *     }
 * }
 * ```
 */
export function InjectRpcClient<RpcInterface extends object = object>(
    service: RpcClientBinding<RpcInterface>,
): TypedParameterDecorator<RpcClient<RpcInterface>> {
    return injectWithTransform(
        RpcClientFactory,
        RpcClientFactoryTransform,
        service.toString(),
    ) as TypedParameterDecorator<RpcClient<RpcInterface>>;
}

/**
 * Used to transform a RpcClientFactory into a RpcClient.
 */
class RpcClientFactoryTransform implements InjectionTransform<
    RpcClientFactory,
    RpcClient<any>
> {
    public transform(
        rpcClientFactory: RpcClientFactory,
        service: InjectionToken,
    ): RpcClient<any> {
        let serviceName: string = '';
        if (typeof service === 'string') {
            serviceName = service;
        } else if (typeof service === 'symbol') {
            serviceName = service.toString();
        } else if (typeof service === 'function') {
            serviceName = service.name;
        } else {
            throw new Error(
                `Invalid RPC service injection token: ${typeof service}`,
            );
        }
        return rpcClientFactory.createClient(serviceName);
    }
}
