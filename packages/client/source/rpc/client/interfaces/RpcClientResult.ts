// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { RpcResult } from '@system-inc/base-common/rpc/protocol/RpcResponse';

/**
 * Represents the result of an RPC call, including the HTTP response status.
 */
export type RpcClientResult<T extends RpcResult> = T & {
    http: {
        status: number;
        statusText: string;
    };
};
