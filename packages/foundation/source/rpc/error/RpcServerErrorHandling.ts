// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { rpcError } from '@system-inc/base-client/rpc/client/error/RpcClientErrorHandling';
import { RpcCall } from '@system-inc/base-common/rpc/protocol/RpcCall';
import { RPC_ERROR_CODE_NOT_FOUND } from '@system-inc/base-common/rpc/protocol/RpcErrorCode';
import { RpcFailure } from '@system-inc/base-common/rpc/protocol/RpcResponse';

export function rpcErrorNotFound(rpc: RpcCall): RpcFailure {
    return rpcError(
        rpc,
        RPC_ERROR_CODE_NOT_FOUND,
        `Remote procedure ${rpc.procedure} not found.`,
    );
}
