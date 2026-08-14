// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { FetchRpcClientDriver } from '@system-inc/base-client/rpc/client/driver/FetchRpcClientDriver';
import { RpcClientDriver } from '@system-inc/base-client/rpc/client/driver/RpcClientDriver';
import { RpcClient } from '@system-inc/base-client/rpc/client/RpcClient';
import { namedConfigurationGetValue } from '@system-inc/base-common/configuration/NamedConfiguration';
import { isFetcher } from '@system-inc/base-common/http/IsFetcher';
import { BaseConfiguration } from '../../configuration/BaseConfiguration';
import { BaseEnvironmentKey } from '../../configuration/BaseEnvironmentKey';
import { Inject } from '../../dependency-injection/decorators/Inject';
import { Injectable } from '../../dependency-injection/decorators/Injectable';
import { RpcClientSettings } from '../RpcSettings';
import { FetcherRpcClientDriver } from './driver/FetcherRpcClientDriver';

/**
 * Creates a RemoteProcedureClient for the given service name.
 */
@Injectable()
export class RpcClientFactory {
    constructor(
        @Inject(BaseConfiguration)
        private readonly configuration: BaseConfiguration,
    ) {}

    /**
     * Creates a client for the given remote procedure service.
     *
     * @param serviceName
     * @returns
     */
    createClient<RpcInterface extends object>(
        serviceName: string,
    ): RpcClient<RpcInterface> {
        // find the settings for the service passed in, throw an error if not found
        const clientRpcSettings = this.configuration.rpcClient?.find(
            (client) => client.name === serviceName,
        );
        if (!clientRpcSettings) {
            throw new Error(
                `RPC Service not found: ${serviceName}. Did you specify it in your rpc settings?`,
            );
        }
        return this.createClientFromSettings(
            clientRpcSettings,
            this.configuration.runtime.environment.type,
        );
    }

    /**
     * Creates a client from the given RPC settings.
     *
     * @param rpcSettings
     * @returns
     */
    createClientFromSettings<RpcInterface extends object>(
        rpcSettings: RpcClientSettings,
        environment: string,
    ): RpcClient<RpcInterface> {
        // create the driver based on the binding
        let rpcDriver: RpcClientDriver | undefined = undefined;

        // if we are running on Cloudflare, check if a binding is specified
        // bindings are only supported by the Cloudflare / Wrangler environment
        const environmentSettings = namedConfigurationGetValue(
            rpcSettings.environments,
            environment,
        );
        if (!environmentSettings) {
            throw new Error(
                `Environment settings not found for: ${rpcSettings.name}`,
            );
        }

        if (
            this.configuration.runtime.platform.isCloudflare &&
            environmentSettings.binding
        ) {
            const binding = this.configuration.getEnvironmentVariable(
                BaseEnvironmentKey.create(environmentSettings.binding),
            );
            if (isFetcher(binding)) {
                rpcDriver = new FetcherRpcClientDriver(
                    this.configuration.name,
                    binding,
                    environmentSettings,
                );
            }
        }
        // if we don't have a driver yet, see if we can instantiate one based on the host
        if (!rpcDriver) {
            if (!environmentSettings.host) {
                throw new Error(
                    `RPC Service host not configured for: ${rpcSettings.name} (environment: ${environment}). ` +
                        `Set a 'host' in the rpc client settings for this environment, ` +
                        `or configure a Cloudflare service binding.`,
                );
            }
            rpcDriver = new FetchRpcClientDriver(environmentSettings.host, {
                secure: environmentSettings.secure,
                endpoint: environmentSettings.endpoint,
            });
        }

        // create the client
        return new RpcClient(rpcDriver);
    }
}
