// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { RpcClient } from '@system-inc/base-client/rpc/client/RpcClient';
import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { CfDurableObjectHandle } from '../cloudflare/durable-object/CfDurableObjectHandle';
import { CfDurableObjectProvider } from '../cloudflare/durable-object/CfDurableObjectProvider';
import { BaseConfiguration } from '../configuration/BaseConfiguration';
import { Platform, PlatformType } from '../configuration/Platform';
import { RequestContext } from '../request/RequestContext';
import { FetcherRpcClientDriver } from '../rpc/client/driver/FetcherRpcClientDriver';
import { WebSocketRpcClientDriver } from '../rpc/client/driver/WebSocketRpcClientDriver';
import { DurableObjectWebSocketBridge } from './cloudflare/DurableObjectWebSocketBridge';
import { DurableObjectWebSocketRpcDriver } from './cloudflare/DurableObjectWebSocketRpcClient';
import { WebSocketErrorEvent, WebSocketEvent } from './WebSocketMessage';
import { WebSocketDelegateSettings } from './WebSocketSettings';
import { BaseWebSocket, WebSocketInfo } from './WebSocketTypes';

/**
 * A delegate that handles web socket connections for a service.
 */
export abstract class WebSocketDelegate {
    private _sockets: Record<string, BaseWebSocket> = {};

    private _durableObjectProvider: CfDurableObjectProvider | null | undefined =
        undefined;

    protected get durableObjectProvider(): CfDurableObjectProvider | null {
        if (this._durableObjectProvider !== undefined) {
            return this._durableObjectProvider;
        }
        try {
            this._durableObjectProvider = CfDurableObjectProvider.create(
                this.namespace,
                this.configuration,
            );
        } catch (error) {
            this._durableObjectProvider = null;
            Logger.warn(
                LogCategory.WebSocket,
                'Failed to create durable object provider:',
                error,
            );
        }
        return this._durableObjectProvider;
    }

    protected get platform(): Platform {
        return this.configuration.runtime.platform;
    }

    protected get settings(): WebSocketDelegateSettings {
        const settings = this.configuration.webSocket?.delegates.find(
            (delegate) => delegate.delegate.name === this.constructor.name,
        );
        if (!settings) {
            throw new Error('WebSocket delegate settings not found.');
        }
        return settings;
    }

    constructor(
        readonly namespace: string,
        protected readonly configuration: BaseConfiguration,
    ) {}

    //region Abstract Methods

    /**
     * Determines if a upgrade request (web socket connection)
     * should be authorized (allowed).
     *
     * If it is allowed, the ID of the socket should be returned,
     * otherwise undefined should be returned.
     *
     * @param request
     */
    abstract authorizeUpgrade(
        request: RequestContext,
    ): Promise<string | undefined>;

    /**
     * Optional hook for populating application-specific values on the
     * {@link WebSocketInfo} context bag for this socket.
     *
     * Called lazily on first use of `WebSocketInfo` for a given socket
     * and cached thereafter. Use {@link setWsContext} with your own
     * {@link WebSocketInfoKey}s to add values the rest of your code
     * will read via {@link getWsContext}.
     *
     * Framework-module values (device id, session id, etc.) are
     * populated automatically at connect time and do not need to be
     * handled here.
     */
    populateSocketContext?(
        info: WebSocketInfo,
        socketId: string,
    ): Promise<void> | void;

    abstract onWebSocketClose(
        webSocket: BaseWebSocket,
        socketInfo: WebSocketInfo,
    ): Promise<void> | void;

    abstract onWebSocketError(
        webSocket: BaseWebSocket,
        socketInfo: WebSocketInfo,
        error: WebSocketErrorEvent,
    ): Promise<void> | void;

    onWebSocketEvent?(
        webSocket: BaseWebSocket,
        webSocketInfo: WebSocketInfo,
        event: WebSocketEvent,
    ): Promise<void> | void;

    //endregion
    //region Public Methods

    getDurableObjectForSocket(
        socketId: string,
    ): CfDurableObjectHandle | undefined {
        return this.durableObjectProvider?.getDurableObject({
            name: socketId,
        });
    }

    getRemoteProcedureClientForSocket<RpcInterface extends object>(
        socketId: string,
    ): RpcClient<RpcInterface> {
        if (this.platform.type === PlatformType.CloudflareWorker) {
            // create the RPC interface so we can send the message
            const durableObject = this.getDurableObjectForSocket(socketId);
            if (!durableObject) {
                throw new Error('Durable object not found for socket id.');
            }
            return new RpcClient<RpcInterface>(
                new DurableObjectWebSocketRpcDriver(
                    this.configuration.name,
                    socketId,
                    durableObject.stub,
                    {
                        endpoint: this.settings.rpcEndpoint,
                    },
                ),
            );
        } else if (this.platform.type === PlatformType.Node) {
            const webSocket = this._sockets[socketId];
            if (!webSocket) {
                throw new Error('Socket not found for socket id.');
            }
            return new RpcClient<RpcInterface>(
                new WebSocketRpcClientDriver(
                    this.configuration.name,
                    this.settings.name,
                    webSocket,
                    {
                        endpoint: this.settings.rpcEndpoint,
                    },
                ),
            );
        } else {
            throw new Error('Unsupported platform.');
        }
    }

    emitEventOnSocket<T extends WebSocketEvent>(
        event: T,
        socketId: string,
    ): Promise<void> | void {
        if (this.platform.type === PlatformType.CloudflareWorker) {
            // create the RPC interface so we can send the message
            const durableObject = this.getDurableObjectForSocket(socketId);
            if (!durableObject) {
                throw new Error('Durable object not found for socket id.');
            }
            const rpcClient = new RpcClient<DurableObjectWebSocketBridge>(
                new FetcherRpcClientDriver(
                    this.configuration.name,
                    durableObject.stub,
                ),
            );
            return rpcClient.call().emitWebSocketEvent(event, socketId);
        } else if (this.platform.type === PlatformType.Node) {
            const webSocket = this._sockets[socketId];
            if (!webSocket) {
                throw new Error('Socket not found for socket id.');
            }
            webSocket.send(JSON.stringify(event));
        } else {
            throw new Error('Unsupported platform.');
        }
    }

    /**
     * Reads the {@link WebSocketInfo} for a connected socket. On Cloudflare
     * this queries the Durable Object bridge (which owns the socket) via a
     * Fetcher RPC — the same transport {@link emitEventOnSocket} uses — NOT
     * getRemoteProcedureClientForSocket, whose driver pushes events to the
     * connected client rather than answering DO-side queries.
     */
    async getWebSocketInfoFromSocket(
        socketId: string,
    ): Promise<WebSocketInfo | undefined> {
        if (this.platform.type === PlatformType.CloudflareWorker) {
            const durableObject = this.getDurableObjectForSocket(socketId);
            if (!durableObject) {
                throw new Error('Durable object not found for socket id.');
            }
            const rpcClient = new RpcClient<DurableObjectWebSocketBridge>(
                new FetcherRpcClientDriver(
                    this.configuration.name,
                    durableObject.stub,
                ),
            );
            return rpcClient.call().getWebSocketInfo(socketId);
        } else if (this.platform.type === PlatformType.Node) {
            return (
                this._sockets[socketId]?.deserializeAttachment() ?? undefined
            );
        } else {
            throw new Error('Unsupported platform.');
        }
    }

    /**
     * Used to register a socket with the service. This is used to bind the
     * socket to the context and delegate for the connection.
     *
     * Used only in Node environments.
     *
     * @param webSocket
     * @param webSocketInfo
     */
    registerSocket(webSocket: BaseWebSocket, webSocketInfo: WebSocketInfo) {
        if (this.platform.type === PlatformType.Node) {
            this._sockets[webSocketInfo.socketId] = webSocket;
        }
    }

    /**
     * Used to unregister a socket with the delegate. After this is called,
     * the socket will no longer be bound to the context and delegate.
     *
     * Used only in Node environments.
     *
     * @param webSocketInfo
     */
    unregisterSocket(webSocketInfo: WebSocketInfo) {
        if (this.platform.type === PlatformType.Node) {
            delete this._sockets[webSocketInfo.socketId];
        }
    }

    //endregion
}
