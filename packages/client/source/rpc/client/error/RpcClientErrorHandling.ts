// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseErrorData } from '@system-inc/base-common/error/interfaces/BaseErrorData';
import { RpcCall } from '@system-inc/base-common/rpc/protocol/RpcCall';
import {
    RPC_ERROR_CODE_MALFORMED_RESPONSE,
    RpcErrorCode,
} from '@system-inc/base-common/rpc/protocol/RpcErrorCode';
import { RpcFailure } from '@system-inc/base-common/rpc/protocol/RpcResponse';
import { RpcClientResult } from '../interfaces/RpcClientResult';

export function rpcErrorMalformedResponse(
    rpc: RpcCall,
    response: Response,
): RpcClientResult<RpcFailure> {
    return rpcErrorWithHttpStatus(
        rpc,
        response,
        RPC_ERROR_CODE_MALFORMED_RESPONSE,
        'Malformed response from server',
    );
}

export function rpcErrorWithHttpStatus(
    rpc: RpcCall,
    response: Response,
    code: RpcErrorCode,
    message: string,
): RpcClientResult<RpcFailure> {
    const failure = rpcError(rpc, code, message);
    return {
        ...failure,
        http: {
            status: response.status,
            statusText: response.statusText,
        },
    };
}

export function rpcError(
    rpc: RpcCall,
    code: RpcErrorCode,
    message: string,
    cause?: BaseErrorData,
): RpcFailure {
    return {
        type: 'response',
        status: 'failure',
        id: rpc.id,
        procedure: rpc.procedure,
        error: {
            code,
            message,
            cause,
        },
        __protocol: 'BaseRPC',
        __version: '1.0',
    };
}
