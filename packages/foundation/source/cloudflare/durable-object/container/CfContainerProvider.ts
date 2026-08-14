// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { Container } from '@cloudflare/containers';

import { RpcClient } from '@system-inc/base-client/rpc/client/RpcClient';
import { BaseConfiguration } from '../../../configuration/BaseConfiguration';
import { BaseEnvironmentKey } from '../../../configuration/BaseEnvironmentKey';
import { FetcherRpcClientDriver } from '../../../rpc/client/driver/FetcherRpcClientDriver';
import { resolveExplicitObjectId } from '../CfDurableObjectId';
import { CfDurableObjectInput } from '../CfDurableObjectInput';
import { CfDurableObjectSettings } from '../CfDurableObjectSettings';
import { CfContainerHandle } from './CfContainerHandle';

export const CF_SINGLETON_CONTAINER_NAME = 'cf-container-singleton';

/**
 * A provider for creating containers.
 */
export class CfContainerProvider<
    RpcInterface extends object = object,
    ContainerEnv extends object = object,
> {
    static create<
        RpcInterface extends object = object,
        ContainerEnv extends object = object,
    >(
        namespace: string,
        baseConfiguration: BaseConfiguration,
    ): CfContainerProvider<RpcInterface, ContainerEnv> {
        const containerNamespace = baseConfiguration.getEnvironmentVariable(
            BaseEnvironmentKey.create(namespace),
        );
        if (!isContainerNamespace<ContainerEnv>(containerNamespace)) {
            throw new Error(
                `Container not found: ${namespace}. Did you specify it in your environment variables?`,
            );
        }

        const settings = baseConfiguration.containers?.find(
            (durableObject) => durableObject.namespace === namespace,
        );

        return new CfContainerProvider(
            namespace,
            baseConfiguration.name,
            containerNamespace,
            settings,
        );
    }

    constructor(
        private readonly namespace: string,
        private readonly workerName: string,
        private readonly durableObjectNamespace: DurableObjectNamespace<
            Container<ContainerEnv>
        >,
        private readonly settings?: CfDurableObjectSettings,
    ) {}

    /**
     *
     * @param input
     * @returns
     */
    getContainer(
        input?: CfDurableObjectInput,
    ): CfContainerHandle<RpcInterface, ContainerEnv> {
        const objectId =
            resolveExplicitObjectId(this.durableObjectNamespace, input) ??
            this.durableObjectNamespace.idFromName(CF_SINGLETON_CONTAINER_NAME);
        const stub = this.durableObjectNamespace.get(objectId);
        const client = new RpcClient<RpcInterface>(
            new FetcherRpcClientDriver(this.workerName, stub, {
                endpoint: this.settings?.rpcEndPoint,
            }),
        );
        return {
            binding: this.namespace,
            container: stub,
            rpc: client,
        };
    }

    getRandomContainer(
        instances: number = 3,
    ): CfContainerHandle<RpcInterface, ContainerEnv> {
        // Generate a random ID within the range of instances
        const randomId = Math.floor(Math.random() * instances).toString();
        return this.getContainer({
            name: `${this.namespace}-instance-${randomId}`,
        });
    }
}

function isContainerNamespace<ContainerEnv>(
    namespace: unknown,
): namespace is DurableObjectNamespace<Container<ContainerEnv>> {
    return (
        typeof namespace === 'object' &&
        namespace !== null &&
        'idFromString' in namespace &&
        typeof namespace.idFromString === 'function' &&
        'idFromName' in namespace &&
        typeof namespace.idFromName === 'function' &&
        'newUniqueId' in namespace &&
        typeof namespace.newUniqueId === 'function' &&
        'get' in namespace &&
        typeof namespace.get === 'function'
    );
}
