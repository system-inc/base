// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Fetchable } from '@system-inc/base-common/http/Fetchable';
import { RpcClientDriver } from './RpcClientDriver';
import {
    getRpcServiceUrl,
    RpcClientDriverOptions,
} from './RpcClientDriverOptions';

/**
 * An RPC client driver that uses the global Fetch API to send requests.
 */
export class FetchableRpcClientDriver extends RpcClientDriver {
    readonly serviceUrl: string;

    constructor(
        readonly host: string,
        readonly fetchable: Fetchable,
        options?: RpcClientDriverOptions,
    ) {
        super();
        this.serviceUrl = getRpcServiceUrl(host, options);
    }

    override sendRequest(request: RequestInit): Promise<Response> {
        return this.fetchable.fetch(this.serviceUrl, request);
    }
}
