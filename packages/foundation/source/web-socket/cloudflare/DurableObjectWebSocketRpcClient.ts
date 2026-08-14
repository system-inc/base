// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { RpcClientDriver } from '@system-inc/base-client/rpc/client/driver/RpcClientDriver';
import { RpcClientDriverOptions } from '@system-inc/base-client/rpc/client/driver/RpcClientDriverOptions';
import { RpcClient } from '@system-inc/base-client/rpc/client/RpcClient';
import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { RpcCall } from '@system-inc/base-common/rpc/protocol/RpcCall';
import { FetcherRpcClientDriver } from '../../rpc/client/driver/FetcherRpcClientDriver';
import { webSocketRpcSuccessResponse } from '../../rpc/client/driver/WebSocketRpcResponse';
import { DurableObjectWebSocketBridge } from './DurableObjectWebSocketBridge';

/**
 * An RPC driver that uses a Durable Object to send RPCs
 * to a client that is connected to it via a web socket.
 */
export class DurableObjectWebSocketRpcDriver extends RpcClientDriver {
    private durableObjectToWebSocketBridge: RpcClient<DurableObjectWebSocketBridge>;

    constructor(
        readonly origin: string,
        readonly socketId: string,
        readonly durableObjectStub: DurableObjectStub,
        options?: RpcClientDriverOptions,
    ) {
        super();
        this.durableObjectToWebSocketBridge = new RpcClient(
            new FetcherRpcClientDriver(origin, durableObjectStub, options),
        );
    }

    override async sendRequest(request: RequestInit): Promise<Response> {
        Logger.debug(
            LogCategory.WebSocket,
            'DurableObjectWebSocketRpcDriver.sendRequest',
        );
        if (typeof request.body !== 'string') {
            throw new Error('Request body must be a string');
        }
        const rpcCall = JSON.parse(request.body) as RpcCall;
        // TODO get headers into the rpc call
        await this.durableObjectToWebSocketBridge.call().emitWebSocketEvent(
            {
                type: rpcCall.procedure,
                origin: this.origin,
                arguments: rpcCall.arguments,
            },
            this.socketId,
        );
        return webSocketRpcSuccessResponse(rpcCall);
    }
}
