// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { IncomingMessage, Server } from 'http';
import { WebSocketServer } from 'ws';

import { HttpStatusCode } from '@system-inc/base-common/http/HttpStatus';
import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { Dictionary } from '@system-inc/base-common/type/Dictionary';
import { EnvironmentVariables } from '../../configuration/EnvironmentVariables';
import { DetachedExecutionContext } from '../../internal/execution-context/DetachedExecutionContext';
import { BaseWorker } from '../../worker/BaseWorker';
import { WebSocketInfo } from '../WebSocketTypes';
import { NodeWebSocket } from './NodeWebSocketTypes';
import { NodeWebSocketWrapper } from './NodeWebSocketWrapper';

export class NodeWebSocketServer {
    protected socketServers: Dictionary<WebSocketServer> = {};

    constructor(private readonly worker: BaseWorker) {}

    listenForConnections(
        httpServer: Server,
        environmentVariables: EnvironmentVariables,
    ) {
        httpServer.on('upgrade', (nodeRequest, socket, head) => {
            this.handleUpgrade(
                nodeRequest,
                socket,
                head,
                environmentVariables,
            ).catch((error: unknown) => {
                Logger.warn(
                    LogCategory.WebSocket,
                    'Error authorizing WebSocket upgrade:',
                    nodeRequest.url,
                    error,
                );
                try {
                    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                    socket.destroy();
                } catch {
                    // socket may already be destroyed
                }
            });
        });
    }

    private async handleUpgrade(
        nodeRequest: IncomingMessage,
        socket: import('stream').Duplex,
        head: Buffer,
        environmentVariables: EnvironmentVariables,
    ): Promise<void> {
        // create a standard fetch api request out of the node request
        const request = nodeIncomingMessageToRequest(nodeRequest);
        Logger.debug(
            LogCategory.WebSocket,
            'Upgrade request: %s',
            nodeRequest.url,
        );

        // authorize the connection through the standard base worker
        const response = await this.worker.fetch(
            request,
            environmentVariables,
            new DetachedExecutionContext(),
        );

        // TODO not handling execution context promise here

        // check if the connection is authorized and if not close the connection
        if (response.status !== HttpStatusCode.Ok) {
            Logger.warn(
                LogCategory.WebSocket,
                'Error authorizing WebSocket upgrade:',
                nodeRequest.url,
                response.status,
            );
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
        }

        // get the web socket server or create one if it does not exist
        const webSocketServer = this.getWebSocketServer(
            request,
            environmentVariables,
        );

        // get the context from the response if there is one
        const webSocketInfo: WebSocketInfo = await response.json();

        // upgrade the connection to a WebSocket connection
        webSocketServer.handleUpgrade(
            nodeRequest,
            socket,
            head,
            (ws: NodeWebSocket) => {
                webSocketServer.emit('connection', ws, webSocketInfo);
            },
        );
    }

    private getWebSocketServer(
        request: Request,
        environmentVariables: EnvironmentVariables,
    ): WebSocketServer {
        const requestUrl = new URL(request.url);
        // get the web socket server or create one if it does not exist
        let webSocketServer = this.socketServers[requestUrl.pathname];
        if (!webSocketServer) {
            webSocketServer = new WebSocketServer({
                noServer: true,
            });
            webSocketServer.on(
                'connection',
                (ws: NodeWebSocket, webSocketInfo: WebSocketInfo) => {
                    this.setupWebSocket(
                        environmentVariables,
                        ws,
                        webSocketInfo,
                    );
                },
            );
            this.socketServers[requestUrl.pathname] = webSocketServer;
        }
        return webSocketServer;
    }

    private setupWebSocket(
        environmentVariables: EnvironmentVariables,
        webSocket: NodeWebSocket,
        webSocketInfo: WebSocketInfo,
    ) {
        // wrap the node socket so it appears to be a standard WebSocket
        const wrappedSocket = NodeWebSocketWrapper.wrap(webSocket);
        wrappedSocket.serializeAttachment(webSocketInfo);

        const base = this.worker.getBase(environmentVariables);

        // The base.webSocket* lifecycle methods mirror the Cloudflare
        // DurableObject WebSocket API and return Promises. Node's
        // EventEmitter handlers are sync `(args) => void`, so we
        // fire-and-forget — but log rejections so a failing base hook
        // doesn't disappear into an unhandled rejection.
        const logFailure = (operation: string) => (error: unknown) => {
            Logger.error(
                LogCategory.WebSocket,
                `NodeWebSocketServer.${operation} failed:`,
                error,
            );
        };

        base.webSocketRegister(wrappedSocket, webSocketInfo).catch(
            logFailure('webSocketRegister'),
        );

        webSocket.on('error', (error) => {
            base.webSocketError(wrappedSocket, error).catch(
                logFailure('webSocketError'),
            );
        });
        webSocket.on('message', (data, isBinary) => {
            let dataToPass: string | ArrayBuffer;
            if (!isBinary) {
                dataToPass = data.toString();
            } else if (data instanceof ArrayBuffer) {
                dataToPass = data;
            } else if (Array.isArray(data)) {
                const combined = Buffer.concat(data);
                dataToPass = combined.buffer;
            } else {
                const copy = Buffer.from(data);
                dataToPass = copy.buffer;
            }
            base.webSocketMessage(wrappedSocket, dataToPass).catch(
                logFailure('webSocketMessage'),
            );
        });
        webSocket.on('close', () => {
            Promise.all([
                base.webSocketUnregister(webSocketInfo),
                base.webSocketClose(wrappedSocket),
            ]).catch(logFailure('webSocketClose'));
        });
    }
}

function nodeIncomingMessageToRequest(nodeRequest: IncomingMessage): Request {
    const host = nodeRequest.headers.host ?? 'localhost';
    const url = `http://${host}${nodeRequest.url ?? '/'}`;
    const headers = new Headers();
    for (const [key, value] of Object.entries(nodeRequest.headers)) {
        if (value !== undefined) {
            headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        }
    }
    return new Request(url, {
        method: nodeRequest.method,
        headers,
    });
}
