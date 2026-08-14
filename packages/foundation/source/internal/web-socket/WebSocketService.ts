// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { getRpcServiceUrl } from '@system-inc/base-client/rpc/client/driver/RpcClientDriverOptions';
import { RpcClient } from '@system-inc/base-client/rpc/client/RpcClient';
import {
    BASE_HEADER_WEB_SOCKET_FETCH,
    BASE_HEADER_WEB_SOCKET_ID,
} from '@system-inc/base-common/http/HttpHeaders';
import { isFetcher } from '@system-inc/base-common/http/IsFetcher';
import { Json, JsonObject } from '@system-inc/base-common/json/Json';
import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { DefaultRpcEndpoint } from '@system-inc/base-common/rpc/protocol/DefaultRpcEndpoint';
import { RpcCall } from '@system-inc/base-common/rpc/protocol/RpcCall';
import { Dictionary } from '@system-inc/base-common/type/Dictionary';
import { Base } from '../../base/Base';
import { CloudflareInjections } from '../../cloudflare/CloudflareInjections';
import { BaseEnvironmentKey } from '../../configuration/BaseEnvironmentKey';
import { PlatformType } from '../../configuration/Platform';
import { BaseInjectionContainer } from '../../dependency-injection/BaseInjectionContainer';
import { BaseError } from '../../error/BaseError';
import { HttpErrors } from '../../error/HttpErrors';
import { BaseEventBus } from '../../event/BaseEventBus';
import {
    UnhandledExceptionEvent,
    UnhandledExceptionEventName,
} from '../../event/UnhandledExceptionEvent';
import { FetcherRpcClientDriver } from '../../rpc/client/driver/FetcherRpcClientDriver';
import { WebSocketDelegate } from '../../web-socket/WebSocketDelegate';
import {
    WebSocketErrorEvent,
    WebSocketEvent,
    WebSocketForwardingEvent,
} from '../../web-socket/WebSocketMessage';
import {
    WebSocketDelegateSettings,
    WebSocketSettings,
} from '../../web-socket/WebSocketSettings';
import { BaseWebSocket, WebSocketInfo } from '../../web-socket/WebSocketTypes';
import { BaseExecutionContext } from '../execution-context/BaseExecutionContext';
import { BaseRequest } from '../request/BaseRequest';
import { InternalBaseRequest } from '../request/InternalBaseRequest';

export class WebSocketService {
    private readonly delegateSettings: Dictionary<WebSocketDelegateSettings> =
        {};
    private readonly delegates: Dictionary<WebSocketDelegate> = {};

    constructor(
        private readonly base: Base,
        private readonly settings: WebSocketSettings,
        private readonly injectionContainer: BaseInjectionContainer,
    ) {
        // register the delegates with the container
        for (const delagateSettings of this.settings.delegates) {
            const delegatePath = delagateSettings.path.startsWith('/')
                ? delagateSettings.path
                : `/${delagateSettings.path}`;
            this.delegateSettings[delegatePath] = delagateSettings;
        }
    }

    /**
     * Registers a socket with the web socket server.
     * Only called in Node environments.
     *
     * @param webSocket
     * @param webSocketInfo
     */
    webSocketRegister(webSocket: BaseWebSocket, webSocketInfo: WebSocketInfo) {
        const delegate = this.getDelegateForPath(webSocketInfo.path);
        delegate?.registerSocket(webSocket, webSocketInfo);
    }

    /**
     * Unregisters a socket with the web socket server.
     * Only called in Node environments.
     *
     * @param webSocketInfo
     */
    webSocketUnregister(webSocketInfo: WebSocketInfo) {
        const delegate = this.getDelegateForPath(webSocketInfo.path);
        delegate?.unregisterSocket(webSocketInfo);
    }

    async webSocketMessage(
        webSocket: BaseWebSocket,
        message: string | ArrayBuffer,
    ): Promise<void> {
        // Do NOT log `message` — payloads routinely carry user/PII data.
        Logger.debug(LogCategory.WebSocket, 'webSocketMessage received');
        // currently we only handle string messages
        if (typeof message !== 'string') {
            await this.forwardErrorEventToSocketDelegate(webSocket, {
                type: 'error',
                origin: this.base.configuration.name,
                errorType: 'InvalidMessageType',
                message: 'Binary messages are not supported.',
            });
            return;
        }

        try {
            // check if the message is a WebSocketEvent
            const unknownMessage = JSON.parse(message) as unknown;
            if (!WebSocketEvent.isWebSocketEvent(unknownMessage)) {
                await this.forwardErrorEventToSocketDelegate(webSocket, {
                    type: 'error',
                    origin: this.base.configuration.name,
                    errorType: 'InvalidMessageType',
                    message: 'The message is not a WebSocketEvent.',
                });
                return;
            }
            const event = unknownMessage as WebSocketEvent;

            // first get the web socket info and context for the socket that sent the message
            const webSocketInfo = await this._getWebSocketInfo(webSocket);
            if (!webSocketInfo) {
                // Without attached info we can't tell which delegate owns this
                // socket, so there's nowhere to route an error event. Close the
                // socket rather than throw (which would take down the message
                // handler on the DO / Node server).
                Logger.warn(
                    LogCategory.WebSocket,
                    'WebSocket message received on a socket with no attached info; closing.',
                );
                webSocket.close(1011, 'Socket info not found.');
                return;
            }

            // if the event is a forwarding event, we handle it here
            if (WebSocketEvent.isWebSocketForwardingEvent(event)) {
                const forwardingEvent = event as WebSocketForwardingEvent;
                // if we are the target of the forwarding event, we handle it here
                if (forwardingEvent.target === this.base.configuration.name) {
                    await this.handleWebSocketEvent(webSocket, webSocketInfo, {
                        type: forwardingEvent.originatingType,
                        origin: forwardingEvent.origin,
                        arguments: forwardingEvent.arguments,
                    });
                } // otherwise we forward the event to the target
                else {
                    await this.forwardWebSocketEventToTarget(
                        forwardingEvent,
                        webSocketInfo,
                    );
                }
            } else {
                // if the event is an error event, we handle it here
                if (WebSocketEvent.isWebSocketErrorEvent(event)) {
                    await this.forwardErrorEventToSocketDelegate(
                        webSocket,
                        event,
                    );
                } // otherwise handle the event as a normal message
                else {
                    await this.handleWebSocketEvent(
                        webSocket,
                        webSocketInfo,
                        event,
                    );
                }
            }
        } catch (e) {
            await this.forwardErrorToSocketDelegate(webSocket, e);
        }
    }

    async webSocketClose(webSocket: BaseWebSocket): Promise<void> {
        Logger.debug(LogCategory.WebSocket, 'webSocketClose');
        const webSocketInfo = await this._getWebSocketInfo(webSocket);
        if (!webSocketInfo) {
            // no attachment — nothing to route a close notification to
            return;
        }
        const delegate = this.getDelegateForPath(webSocketInfo.path);
        await delegate?.onWebSocketClose(webSocket, webSocketInfo);
    }

    async webSocketError(
        webSocket: BaseWebSocket,
        error: unknown,
    ): Promise<void> {
        Logger.error(LogCategory.WebSocket, 'webSocketError:', error);
        await this.forwardErrorToSocketDelegate(webSocket, error);
    }

    getWebSocketInfo(
        path: string,
        socketId: string,
    ): Promise<WebSocketInfo | undefined> {
        const webSocketDelegate = this.getDelegateForPath(path);
        if (!webSocketDelegate) {
            throw HttpErrors.notFound();
        }
        return webSocketDelegate.getWebSocketInfoFromSocket(socketId);
    }

    async connectSocket(request: BaseRequest): Promise<Response | Response> {
        let webSocketInfo: WebSocketInfo | undefined = undefined;

        // try to get a delegate for the route, if one doesn't exist
        // it will throw a not found error
        const delegatePath = request.route;
        const webSocketDelegate = this.getDelegateForPath(delegatePath);
        if (!webSocketDelegate) {
            throw HttpErrors.notFound();
        }

        if (
            this.base.configuration.runtime.platform.type ===
            PlatformType.CloudflareDurableObject
        ) {
            // get the socketId for the socket from the headers
            const socketIdHeader = request.headers.get(
                BASE_HEADER_WEB_SOCKET_ID,
            );
            const [path, socketId] = socketIdHeader?.split(':') || [];
            if (!socketId) {
                throw HttpErrors.badRequest({
                    message: 'Invalid WebSocketId header.',
                });
            }
            if (path !== delegatePath) {
                throw HttpErrors.badRequest({
                    message: 'Invalid WebSocketId header.',
                });
            }
            webSocketInfo = this.buildWebSocketInfo(
                request,
                delegatePath,
                socketId,
            );
        } else {
            // for all other platforms we need to authorize the connection
            // and get the context from the delegate for that connection

            // make sure we have an upgrade request, otherwise throw an error
            const upgradeHeader = request.headers.get('Upgrade');
            if (!upgradeHeader || upgradeHeader !== 'websocket') {
                throw HttpErrors.upgradeRequired();
            }

            // determine if the request is allowed
            const socketId = await webSocketDelegate.authorizeUpgrade(
                request.context,
            );
            if (!socketId) {
                throw HttpErrors.unauthorized();
            }
            webSocketInfo = this.buildWebSocketInfo(
                request,
                delegatePath,
                socketId,
            );
        }

        if (!webSocketInfo) {
            throw new Error('Unable to parse web socket info from request.');
        }

        // decide what to do with the context based on the platform
        switch (this.base.configuration.runtime.platform.type) {
            case PlatformType.CloudflareWorker:
                // Worker just forwards to the DO, which re-runs connect
                // and populates its own WebSocketInfo. No delegate hook
                // needed on this side.
                return this.connectCloudflareWorkerWebSocket(
                    request,
                    webSocketInfo,
                    webSocketDelegate,
                );
            case PlatformType.CloudflareDurableObject:
                await webSocketDelegate.populateSocketContext?.(
                    webSocketInfo,
                    webSocketInfo.socketId,
                );
                return this.connectWebSocketCloudflareDurableObject(
                    request,
                    webSocketInfo,
                );
            case PlatformType.Node:
                // for the node environment we return the context through the response
                // this is a hack to get the context to the websocket server
                // which will then bind the context to the socket using the
                // registerSocket method above
                await webSocketDelegate.populateSocketContext?.(
                    webSocketInfo,
                    webSocketInfo.socketId,
                );
                return Response.json(webSocketInfo);
            default:
                throw HttpErrors.notImplemented();
        }
    }

    //region Private Methods

    private getDelegateForPath(
        delegatePath: string,
    ): WebSocketDelegate | undefined {
        const delegateSettings = this.delegateSettings[delegatePath];
        if (!delegateSettings) {
            return undefined;
        }

        if (!this.delegates[delegatePath]) {
            const delegate = this.injectionContainer.resolve(
                delegateSettings.delegate,
            );
            this.delegates[delegatePath] = delegate;
        }

        return this.delegates[delegatePath];
    }

    private async connectCloudflareWorkerWebSocket(
        request: BaseRequest,
        webSocketInfo: WebSocketInfo,
        delegate: WebSocketDelegate,
    ): Promise<Response> {
        // Forward the request to the Durable Object which will handle
        // the actual creation and maintence of the WebSocket connection.

        // get the durable object for the connection from the delegate
        const durableObject = delegate.getDurableObjectForSocket(
            webSocketInfo.socketId,
        );
        if (!durableObject) {
            Logger.warn(
                LogCategory.WebSocket,
                'Durable object not found for socket id.',
            );
            throw HttpErrors.notFound();
        }

        Logger.debug(
            LogCategory.WebSocket,
            'Forwarding request to durable object',
            webSocketInfo,
        );

        // forward the request to the durable object to finish setting up the connection
        const headers: Record<string, string> = {};
        request.headers.forEach((value, key) => {
            headers[key] = value;
        });
        // Set the server-authorized socket identity LAST, so a client that
        // sends its own base-websocket-id header cannot override the
        // identity authorizeUpgrade granted for this connection. (forEach
        // lowercases keys, matching the constant, so this overwrites any
        // incoming value rather than adding a second header.)
        headers[BASE_HEADER_WEB_SOCKET_ID] =
            webSocketInfo.path + ':' + webSocketInfo.socketId;
        return durableObject.stub.fetch(request.url, {
            method: 'GET',
            headers: headers,
        });
    }

    private async connectWebSocketCloudflareDurableObject(
        request: BaseRequest,
        webSocketInfo: WebSocketInfo,
    ): Promise<Response> {
        // Creates two ends of a WebSocket connection.
        const webSocketPair = new WebSocketPair();
        const [client, server] = Object.values(
            webSocketPair,
        ) as BaseWebSocket[];

        // get the durable object state
        const durableObjectState =
            this.injectionContainer.resolve<DurableObjectState>(
                CloudflareInjections.DurableObjectState.toString(),
            );

        // check if another connection is already open for this socketId
        // (e.g. a reconnect) and close it. Only the stale socket(s) are
        // closed — never storage: deleteAll() here would wipe the Durable
        // Object's entire persisted state (ORM tables, alarm state, app
        // data) on an ordinary reconnect.
        const existingSockets = durableObjectState.getWebSockets(
            webSocketInfo.socketId,
        );
        if (existingSockets.length > 0) {
            Logger.warn(
                LogCategory.WebSocket,
                'Closing existing sockets for socketId: ',
                webSocketInfo.socketId,
            );
            for (const existingSocket of existingSockets) {
                existingSocket.close(1000, 'Replaced by a new connection.');
            }
        }

        // connect the websocket to the durable object
        durableObjectState.acceptWebSocket(server, [webSocketInfo.socketId]);

        // bind the socket info to the client socket
        if (webSocketInfo) {
            server.serializeAttachment(webSocketInfo);
        }

        Logger.debug(
            LogCategory.WebSocket,
            'WebSocket connection accepted: ',
            request.route,
        );

        return new Response(null, {
            status: 101,
            webSocket: client,
        });
    }

    private async _getWebSocketInfo(
        webSocket: BaseWebSocket,
    ): Promise<WebSocketInfo | null> {
        // Return null rather than throw when a socket carries no attachment.
        // The error-reporting path (forwardErrorEventToSocketDelegate) also
        // resolves the info to find the delegate, so throwing here made the
        // error handler itself throw — and left the `!webSocketInfo` guards
        // unreachable. Callers can't route to a delegate without the info, so
        // they handle null by logging/closing instead.
        return webSocket.deserializeAttachment() ?? null;
    }

    /**
     * Builds a {@link WebSocketInfo} for a newly-authorized connection,
     * mirroring module-registered {@link RequestContext} values into
     * the shared `context` bag.
     *
     * Delegates may further populate app-specific values via
     * {@link WebSocketDelegate.populateSocketContext}; this is called
     * by the connect flow before the attachment is serialized.
     */
    private buildWebSocketInfo(
        request: BaseRequest,
        path: string,
        socketId: string,
    ): WebSocketInfo {
        const context: JsonObject = {};
        const mappings = this.settings.mappings ?? [];
        for (const mapping of mappings) {
            const value = request.context.get(mapping.rcKey);
            if (value !== undefined) {
                context[mapping.wsKey.name] = value as Json;
            }
        }
        return {
            path,
            socketId,
            context,
        };
    }

    private async handleWebSocketEvent(
        webSocket: BaseWebSocket,
        webSocketInfo: WebSocketInfo,
        event: WebSocketEvent,
    ) {
        // if the delegate overrides the onWebSocketEvent method, call it
        // otherwise we handle the event as a remote procedure call
        const delegate = this.getDelegateForPath(webSocketInfo.path);
        if (delegate?.onWebSocketEvent) {
            try {
                await delegate.onWebSocketEvent(
                    webSocket,
                    webSocketInfo,
                    event,
                );
            } catch (e) {
                // an error the app didn't model escaped the delegate —
                // surface it to unhandled-exception listeners (delivered by
                // the post-event drain), then rethrow so the existing error
                // forwarding to the socket behaves exactly as before. (The
                // RPC-over-socket path below is covered by the 'rpc'
                // surface inside base.handleRequest.)
                if (BaseError.forClient(e).masked) {
                    this.injectionContainer
                        .resolve(BaseEventBus)
                        .defer<UnhandledExceptionEvent>({
                            name: UnhandledExceptionEventName,
                            error: e,
                            surface: 'websocket',
                            detail: `${webSocketInfo.path} ${event.type}`,
                        });
                }
                throw e;
            }
            return;
        }

        try {
            // if the hostname matches ours, it is to be processed locally
            const internalHostname = InternalBaseRequest.getInternalHostName(
                event.origin,
            );
            const rpcEndpoint =
                this.base.configuration.rpcServer?.route || DefaultRpcEndpoint;
            const internalRequest = new Request(
                getRpcServiceUrl(internalHostname, {
                    endpoint: rpcEndpoint,
                }),
                {
                    headers: {
                        [BASE_HEADER_WEB_SOCKET_FETCH]: 'true',
                        [BASE_HEADER_WEB_SOCKET_ID]:
                            webSocketInfo.path + ':' + webSocketInfo.socketId,
                    },
                    method: 'POST',
                    body: JSON.stringify({
                        id: crypto.randomUUID(),
                        type: 'request',
                        procedure: event.type,
                        arguments: event.arguments ?? [],
                        __protocol: 'BaseRPC',
                        __version: '1.0',
                    } satisfies RpcCall),
                },
            );

            // create and handle the fetch request with the socket context added
            await this.base.handleRequest(
                internalRequest,
                new BaseExecutionContext(performance.now()),
                webSocketInfo,
            );
        } catch (e) {
            await this.forwardErrorToSocketDelegate(webSocket, e);
        }
    }

    private async forwardWebSocketEventToTarget(
        event: WebSocketForwardingEvent,
        webSocketInfo: WebSocketInfo,
    ) {
        // get the worker that is the forwarding target
        const targetWorker = this.base.configuration.getEnvironmentVariable(
            BaseEnvironmentKey.create(event.target),
        );
        if (!isFetcher(targetWorker)) {
            throw new Error('Target worker not found for forwarding event.');
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rpcClient = new RpcClient<any>(
            new FetcherRpcClientDriver(event.origin, targetWorker, {
                endpoint: event.rpcEndpoint,
            }),
            {
                headers: {
                    [BASE_HEADER_WEB_SOCKET_FETCH]: 'true',
                    [BASE_HEADER_WEB_SOCKET_ID]:
                        webSocketInfo.path + ':' + webSocketInfo.socketId,
                },
            },
        );
        return await rpcClient.callProcedure(
            event.originatingType,
            event.arguments ?? [],
            {
                meta: webSocketInfo,
            },
        );
    }

    private async forwardErrorEventToSocketDelegate(
        webSocket: BaseWebSocket,
        errorEvent: WebSocketErrorEvent,
    ) {
        Logger.error(LogCategory.WebSocket, 'WebSocket error:', errorEvent);
        const webSocketInfo = await this._getWebSocketInfo(webSocket);
        if (!webSocketInfo) {
            // no attachment — we can't resolve the owning delegate, so the
            // error can only be logged (above), not forwarded. Returning here
            // is also what keeps this reporting path from throwing.
            return;
        }
        // look up by path, like every sibling (onWebSocketClose etc.) — a
        // socketId never matches a registered delegate path, so passing it
        // here made onWebSocketError silently no-op for every consumer.
        const delegate = this.getDelegateForPath(webSocketInfo.path);
        await delegate?.onWebSocketError(webSocket, webSocketInfo, errorEvent);
    }

    private async forwardErrorToSocketDelegate(
        webSocket: BaseWebSocket,
        error?: unknown,
    ) {
        if (error instanceof Error) {
            await this.forwardErrorEventToSocketDelegate(webSocket, {
                type: 'error',
                origin: this.base.configuration.name,
                errorType: error.name,
                message: error.message,
            });
        } else if (typeof error === 'string') {
            await this.forwardErrorEventToSocketDelegate(webSocket, {
                type: 'error',
                origin: this.base.configuration.name,
                errorType: 'Unknown',
                message: error,
            });
        } else {
            await this.forwardErrorEventToSocketDelegate(webSocket, {
                type: 'error',
                origin: this.base.configuration.name,
                errorType: 'Unknown',
                message: 'An Unknown error occurred.',
            });
        }
    }

    //endregion
}
