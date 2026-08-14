// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { RpcClientDriver } from '@system-inc/base-client/rpc/client/driver/RpcClientDriver';
import { RpcClientDriverOptions } from '@system-inc/base-client/rpc/client/driver/RpcClientDriverOptions';
import { RpcCall } from '@system-inc/base-common/rpc/protocol/RpcCall';
import { HttpErrors } from '../../../error/HttpErrors';
import { WebSocketForwardingEvent } from '../../../web-socket/WebSocketMessage';
import { BaseWebSocket } from '../../../web-socket/WebSocketTypes';
import { webSocketRpcSuccessResponse } from './WebSocketRpcResponse';

/**
 * An RPC client driver that forwards RPCs to a WebSocket as WebSocketEvents.
 */
export class WebSocketRpcClientDriver extends RpcClientDriver {
    constructor(
        private readonly origin: string,
        private readonly target: string,
        private readonly webSocket: BaseWebSocket,
        private readonly options?: RpcClientDriverOptions,
    ) {
        super();
    }

    async sendRequest(request: RequestInit): Promise<Response> {
        if (typeof request.body !== 'string') {
            throw HttpErrors.badRequest({ message: 'Invalid request body' });
        }
        const rpc: RpcCall = JSON.parse(request.body);
        const event: WebSocketForwardingEvent = {
            type: 'forwarding',
            arguments: rpc.arguments,
            originatingType: rpc.procedure,
            origin: this.origin,
            target: this.target,
            rpcEndpoint: this.options?.endpoint,
        };
        this.webSocket.send(JSON.stringify(event));
        return webSocketRpcSuccessResponse(rpc);
    }
}
