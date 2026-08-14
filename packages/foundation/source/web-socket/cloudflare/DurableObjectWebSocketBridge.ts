// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { CloudflareInjections } from '../../cloudflare/CloudflareInjections';
import { Inject } from '../../dependency-injection/decorators/Inject';
import { WorkerScoped } from '../../dependency-injection/decorators/WorkerScoped';
import { Rpc } from '../../rpc/decorators/Rpc';
import { RpcService } from '../../rpc/decorators/RpcService';
import { WebSocketEvent } from '../WebSocketMessage';
import { BaseWebSocket, WebSocketInfo } from '../WebSocketTypes';

/**
 * A service that provides a bridge between durable objects
 * and web sockets. Runs on the durable object to allow RPCs to flow
 * from a worker through the durable object to the web socket.
 */
@RpcService()
@WorkerScoped()
export class DurableObjectWebSocketBridge {
    constructor(
        @Inject(CloudflareInjections.DurableObjectState)
        private readonly durableObjectState: DurableObjectState,
    ) {}

    /**
     * Emits the event provided on the web socket for the id provided.
     *
     * Forwards an event originating from a worker
     * through a durable object to the web socket with the socketId.
     *
     * @param event
     * @param socketId
     */
    @Rpc()
    async emitWebSocketEvent<T extends WebSocketEvent>(
        event: T,
        socketId: string,
    ): Promise<void> {
        Logger.debug(
            LogCategory.WebSocket,
            'DurableObjectWebSocketBridgeService.emitWebSocketEvent',
            event,
        );
        const socket = this.getWebSocket(socketId);
        if (!socket) {
            throw new Error(`No socket found for socketId: ${socketId}`);
        }
        const socketInfo: WebSocketInfo = socket.deserializeAttachment();
        if (!socketInfo) {
            throw new Error(`Socket info not found for socketId: ${socketId}`);
        }
        socket.send(JSON.stringify(event));
    }

    /**
     * Broadcasts a web socket event to all web sockets with the provided tags.
     * If no tags are provided, the event is broadcast to all web sockets.
     *
     * The event originates from a worker and is sent through a durable object
     * to the web sockets.
     *
     * @param event
     * @param tags
     */
    @Rpc()
    async broadcastWebSocketEvent(
        event: WebSocketEvent,
        tags?: string[],
    ): Promise<void> {
        Logger.debug(
            LogCategory.WebSocket,
            'DurableObjectWebSocketBridgeService.broadcastWebSocketEvent',
            this.durableObjectState.id,
        );
        // get the sockets for the associated tags
        const sockets: WebSocket[] = [];
        if (!tags) {
            sockets.push(...this.durableObjectState.getWebSockets());
        } else {
            for (const tag of tags) {
                sockets.push(...this.durableObjectState.getWebSockets(tag));
            }
        }
        // broadcast to all sockets with the provided tags
        for (const socket of sockets) {
            socket.send(JSON.stringify(event));
        }
    }

    /**
     * Gets the web socket info for the provided socketId.
     *
     * @param socketId
     * @returns
     */
    @Rpc()
    async getWebSocketInfo(
        socketId: string,
    ): Promise<WebSocketInfo | undefined> {
        const webSocket = this.getWebSocket(socketId);
        if (webSocket) {
            return webSocket.deserializeAttachment();
        }
    }

    // consider moving this to a common place to be shared with consumers
    private getWebSocket(socketId: string): BaseWebSocket | undefined {
        Logger.debug(
            LogCategory.WebSocket,
            'DurableObjectWebSocketBridgeService.getWebSocket',
        );
        // get all the sockets we need to send the rpc message to
        const sockets = this.durableObjectState.getWebSockets(
            socketId,
        ) as BaseWebSocket[];
        if (sockets.length === 0) {
            return undefined;
        } else if (sockets.length > 1) {
            Logger.warn(
                LogCategory.WebSocket,
                'Multiple sockets found for tag: %s, using the first one.',
                socketId,
            );
        }
        return sockets[0];
    }
}
