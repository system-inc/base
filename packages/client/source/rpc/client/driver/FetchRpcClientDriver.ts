// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { RpcClientDriver } from './RpcClientDriver';
import {
    getRpcServiceUrl,
    RpcClientDriverOptions,
} from './RpcClientDriverOptions';

/**
 * An RPC client driver that uses the global Fetch API to send requests.
 */
export class FetchRpcClientDriver extends RpcClientDriver {
    readonly serviceUrl: string;

    constructor(
        readonly host: string,
        options?: RpcClientDriverOptions,
    ) {
        super();
        this.serviceUrl = getRpcServiceUrl(host, options);
    }

    override sendRequest(request: RequestInit): Promise<Response> {
        return fetch(this.serviceUrl, request);
    }
}
