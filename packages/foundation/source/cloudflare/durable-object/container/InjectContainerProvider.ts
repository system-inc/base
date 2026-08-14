// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { InjectionToken, injectWithTransform } from 'tsyringe';

import { Injectable } from '../../../dependency-injection/decorators/Injectable';
import { InjectionTransform } from '../../../dependency-injection/InjectionTransform';
import { TypedParameterDecorator } from '../../../dependency-injection/TypedParameterDecorator';
import { BaseWorkerContext } from '../../../worker/BaseWorkerContext';
import { CfContainerProvider } from './CfContainerProvider';
import { ContainerBinding } from './ContainerBinding';

/**
 * Injects a Cloudflare Container bound to the namespace declared by
 * the given `ContainerBinding`.
 */
export function InjectContainerProvider(
    namespaceToken: ContainerBinding,
): TypedParameterDecorator<CfContainerProvider> {
    return injectWithTransform(
        BaseWorkerContext,
        DurableObjectProviderTransform,
        namespaceToken.toString(),
    ) as TypedParameterDecorator<CfContainerProvider>;
}

/**
 * Used to transform a RemoteProcedureClientFactory into a RemoteProcedureClient.
 */
@Injectable()
class DurableObjectProviderTransform implements InjectionTransform<
    BaseWorkerContext,
    CfContainerProvider
> {
    public transform(
        workerContext: BaseWorkerContext,
        namespaceToken: InjectionToken,
    ): CfContainerProvider {
        // try to resolve the namespace using the container
        let namespace: string;
        try {
            namespace = workerContext.container.resolve(namespaceToken);
        } catch (e) {
            namespace = namespaceToken.toString();
        }
        return CfContainerProvider.create(
            namespace,
            workerContext.configuration,
        );
    }
}
