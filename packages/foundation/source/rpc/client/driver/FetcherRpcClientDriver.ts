// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { RpcClientDriver } from '@system-inc/base-client/rpc/client/driver/RpcClientDriver';
import {
    getRpcServiceUrl,
    RpcClientDriverOptions,
} from '@system-inc/base-client/rpc/client/driver/RpcClientDriverOptions';
import { InternalBaseRequest } from '../../../internal/request/InternalBaseRequest';

/**
 * An RPC client driver that uses a Fetcher to send requests.
 * A Fetcher is an interface from Cloudflare that implements the fetch method.
 */
export class FetcherRpcClientDriver extends RpcClientDriver {
    private readonly serviceUrl: string;

    constructor(
        origin: string,
        readonly fetcher: Fetcher,
        options?: RpcClientDriverOptions,
    ) {
        super();
        const host = InternalBaseRequest.getInternalHostName(origin);
        this.serviceUrl = getRpcServiceUrl(host, {
            ...options,
            secure: true,
        });
    }

    sendRequest(request: RequestInit): Promise<Response> {
        return this.fetcher.fetch(new Request(this.serviceUrl, request));
    }
}
