// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { RpcCall } from '@system-inc/base-common/rpc/protocol/RpcCall';
import { isRpcSuccessResponse } from '@system-inc/base-common/rpc/protocol/RpcResponse';
import { BaseWebSocket } from '../../../web-socket/WebSocketTypes';
import { WebSocketRpcClientDriver } from './WebSocketRpcClientDriver';

const rpc = {
    type: 'request',
    procedure: 'notify',
    arguments: [],
    id: 'call-1',
    __version: '1.0',
    __protocol: 'BaseRPC',
} as unknown as RpcCall;

describe('WebSocketRpcClientDriver socket-push response', () => {
    it('returns a response that handleResponse accepts as an RpcSuccess', async () => {
        const sent: string[] = [];
        const webSocket = {
            send: (data: string) => sent.push(data),
        } as unknown as BaseWebSocket;
        const driver = new WebSocketRpcClientDriver(
            'origin.example',
            'target.example',
            webSocket,
        );

        const response = await driver.sendRequest({
            body: JSON.stringify(rpc),
        });

        // the event was pushed to the socket...
        expect(sent).toHaveLength(1);

        // ...and the driver's own handleResponse accepts the reply as success
        // (rather than throwing on a bodyless ok())
        const result = await driver.handleResponse(rpc, response);
        expect(isRpcSuccessResponse(result)).toBe(true);
        expect(result.id).toBe('call-1');
    });
});
