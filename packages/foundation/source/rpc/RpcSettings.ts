// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { NamedConfiguration } from '@system-inc/base-common/configuration/NamedConfiguration';
import { RequireAny } from '@system-inc/base-common/type/UtilityTypes';
import { RpcVisibility } from './RpcVisibility';

/**
 * Settings for RPCs in the worker.
 */
export interface RpcSettings {
    /**
     * Settings for calling RPCs from this worker.
     */
    readonly client?: RpcClientSettings[];

    /**
     *  Settings for the RPC service that will be served by this worker.
     */
    readonly service?: RpcServiceSettings;
}

/**
 * Settings for the RPC service that will be served by this worker.
 */
export interface RpcServiceSettings {
    /**
     * Override the default endPoint that serves the RPC service here.
     * See DefaultRemoteProcedureEndpoint.
     */
    readonly route?: string;

    /**
     * Whether the RPC service should be callable from a public route.
     *
     * If set to 'public', the RPC service will be callable from a public route.
     * If set to 'internal', the RPC service will only be callable from a bound worker.
     *
     * The default value is 'internal' if unspecified.
     */
    readonly visibility?: RpcVisibility;

    /**
     * A list of workers that are allowed
     * to bind to this worker and call its RPCs.
     *
     * This is only relevant if the visibility is set to 'internal'.
     */
    readonly allowedWorkers?: string[];
}

export interface RpcClientSettings {
    /**
     * A name used to designate this RPC with.
     *
     * You can use this to inject an instance of an
     * RPC client bound to a specific RPC service.
     */
    readonly name: string;

    environments: NamedConfiguration<
        RequireAny<
            {
                /**
                 * Only supported in the Cloudflare environment.
                 *
                 * The name of the binding that exposes the fetch interface
                 * to the service that hosts the remote procedure.
                 *
                 * This allows you to perform RPCs to bound workers.
                 * This is the preferred method for calling RPCs in the Cloudflare environment.
                 */
                readonly binding?: string;

                /**
                 * The host of the RPC service.
                 *
                 * This is used as a secondary endpoint to call the RPC service at,
                 * if the binding is not specified or the environment is not Cloudflare.
                 */
                readonly host?: string;

                /**
                 * The endpoint to call the RPC service at.
                 * If not specified, the default endpoint will be used.
                 */
                readonly endpoint?: string;

                /**
                 * Whether the RPC should be called securely.
                 * If set to true, the RPC will be called using HTTPS.
                 *
                 * The default value is false if unspecified
                 */
                readonly secure?: boolean;
            },
            'binding' | 'host'
        >
    >;
}
