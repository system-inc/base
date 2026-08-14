// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { InjectionToken, injectWithTransform } from 'tsyringe';

import { Injectable } from '../../dependency-injection/decorators/Injectable';
import { InjectionTransform } from '../../dependency-injection/InjectionTransform';
import { TypedParameterDecorator } from '../../dependency-injection/TypedParameterDecorator';
import { BaseWorkerContext } from '../../worker/BaseWorkerContext';
import { CfDurableObjectProvider } from './CfDurableObjectProvider';
import { DurableObjectBinding } from './DurableObjectBinding';

/**
 * Injects a CloudflareDurableObjectProvider bound to the namespace
 * declared by the given `DurableObjectBinding<RpcInterface>`. The
 * resolved `CfDurableObjectProvider<RpcInterface>` is verified against
 * the parameter's declared type at lint time.
 */
export function InjectDurableObjectProvider<
    RpcInterface extends object = object,
    StubRpcInterface extends Rpc.DurableObjectBranded =
        Rpc.DurableObjectBranded,
>(
    namespaceToken: DurableObjectBinding<RpcInterface, StubRpcInterface>,
): TypedParameterDecorator<
    CfDurableObjectProvider<RpcInterface, StubRpcInterface>
> {
    return injectWithTransform(
        BaseWorkerContext,
        DurableObjectProviderTransform,
        namespaceToken.toString(),
    ) as TypedParameterDecorator<
        CfDurableObjectProvider<RpcInterface, StubRpcInterface>
    >;
}

/**
 * Used to transform a RemoteProcedureClientFactory into a RemoteProcedureClient.
 */
@Injectable()
class DurableObjectProviderTransform implements InjectionTransform<
    BaseWorkerContext,
    CfDurableObjectProvider
> {
    public transform(
        workerContext: BaseWorkerContext,
        namespaceToken: InjectionToken,
    ): CfDurableObjectProvider {
        // try to resolve the namespace using the container
        let namespace: string;
        try {
            namespace = workerContext.container.resolve(namespaceToken);
        } catch (e) {
            namespace = namespaceToken.toString();
        }
        return CfDurableObjectProvider.create(
            namespace,
            workerContext.configuration,
        );
    }
}
