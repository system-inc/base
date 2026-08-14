// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { RpcClient } from '@system-inc/base-client/rpc/client/RpcClient';
import { BaseConfiguration } from '../../configuration/BaseConfiguration';
import { BaseEnvironmentKey } from '../../configuration/BaseEnvironmentKey';
import { FetcherRpcClientDriver } from '../../rpc/client/driver/FetcherRpcClientDriver';
import { CfDurableObjectHandle } from './CfDurableObjectHandle';
import { resolveExplicitObjectId } from './CfDurableObjectId';
import { CfDurableObjectInput } from './CfDurableObjectInput';
import { CfDurableObjectSettings } from './CfDurableObjectSettings';

/**
 * A provider for creating durable objects.
 */
export class CfDurableObjectProvider<
    RpcInterface extends object = object,
    StubRpcInterface extends Rpc.DurableObjectBranded =
        Rpc.DurableObjectBranded,
> {
    /**
     * Creates a new CloudflareDurableObjectProvider for the specified namespace.
     *
     * @param namespace
     * @param baseConfiguration
     * @returns
     */
    static create<
        RpcInterface extends object = object,
        StubRpcInterface extends Rpc.DurableObjectBranded =
            Rpc.DurableObjectBranded,
    >(
        namespace: string,
        baseConfiguration: BaseConfiguration,
    ): CfDurableObjectProvider<RpcInterface, StubRpcInterface> {
        // try to find the durable object in the environment variables
        const durableObjectNamespace = baseConfiguration.getEnvironmentVariable(
            BaseEnvironmentKey.create(namespace),
        );
        if (
            !isDurableObjectNamespace<StubRpcInterface>(durableObjectNamespace)
        ) {
            throw new Error(
                `DurableObject not found: ${namespace}. Did you specify it in your environment variables?`,
            );
        }

        const settings = baseConfiguration.durableObjects?.find(
            (durableObject) => durableObject.namespace === namespace,
        );

        return new CfDurableObjectProvider(
            namespace,
            baseConfiguration.name,
            durableObjectNamespace,
            settings,
        );
    }

    constructor(
        private readonly namespace: string,
        private readonly workerName: string,
        private readonly durableObjectNamespace: DurableObjectNamespace<StubRpcInterface>,
        private readonly settings?: CfDurableObjectSettings,
    ) {}

    /**
     * Gets a durable object handle for the specified input.
     *
     * If no input is provided, a new durable object will be created with a unique id.
     *
     * @param input
     * @returns
     */
    getDurableObject(
        input?: CfDurableObjectInput,
    ): CfDurableObjectHandle<RpcInterface, StubRpcInterface> {
        const objectId =
            resolveExplicitObjectId(this.durableObjectNamespace, input) ??
            this.durableObjectNamespace.newUniqueId();

        const stub = this.durableObjectNamespace.get(objectId);
        const client = new RpcClient<RpcInterface>(
            new FetcherRpcClientDriver(this.workerName, stub, {
                endpoint: this.settings?.rpcEndPoint,
            }),
        );

        return {
            binding: this.namespace,
            stub: stub,
            rpc: client,
        };
    }
}

function isDurableObjectNamespace<
    StubRpcInterface extends Rpc.DurableObjectBranded,
>(namespace: unknown): namespace is DurableObjectNamespace<StubRpcInterface> {
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
