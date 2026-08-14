// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { RpcCall } from '@system-inc/base-common/rpc/protocol/RpcCall';
import { RpcSuccess } from '@system-inc/base-common/rpc/protocol/RpcResponse';
import { HttpResponses } from '../../../http/HttpResponses';

/**
 * A `@WebSocketRpc()` procedure is fire-and-forget (returns `Promise<void>`):
 * the driver pushes the event over the socket and the client sends no reply.
 * Synthesize a well-formed `RpcSuccess` response so the shared
 * `RpcClientDriver.handleResponse` accepts it — the bodyless `ok()` the socket
 * drivers used to return has no JSON content-type or RpcResponse body, so
 * handleResponse always rejected it and every delivered push threw.
 */
export function webSocketRpcSuccessResponse(rpcCall: RpcCall): Response {
    const response: RpcSuccess = {
        type: 'response',
        __version: '1.0',
        __protocol: 'BaseRPC',
        id: rpcCall.id,
        status: 'success',
        result: null,
    };
    return HttpResponses.fromJson(response);
}
