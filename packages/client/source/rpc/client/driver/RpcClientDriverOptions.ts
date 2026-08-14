// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { DefaultRpcEndpoint } from '@system-inc/base-common/rpc/protocol/DefaultRpcEndpoint';

export interface RpcClientDriverOptions {
    secure?: boolean;
    endpoint?: string;
}

export function getRpcServiceUrl(
    host: string,
    options?: RpcClientDriverOptions,
): string {
    let endpoint = options?.endpoint || DefaultRpcEndpoint;
    if (!endpoint.startsWith('/')) {
        endpoint = `/${endpoint}`;
    }
    // If the caller passed a fully-qualified host use it as-is rather
    // than prepending another protocol
    if (/^https?:\/\//.test(host)) {
        return host + endpoint;
    }
    const protocol = options?.secure ? 'https' : 'http';
    return `${protocol}://${host}${endpoint}`;
}
