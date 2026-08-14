// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BASE_HEADER_WEB_SOCKET_ID } from '@system-inc/base-common/http/HttpHeaders';
import { Base } from '../../base/Base';
import { CloudflareInjections } from '../../cloudflare/CloudflareInjections';
import { BaseInjectionContainer } from '../../dependency-injection/BaseInjectionContainer';
import { WebSocketDelegate } from '../../web-socket/WebSocketDelegate';
import { BaseWebSocket } from '../../web-socket/WebSocketTypes';
import { BaseRequest } from '../request/BaseRequest';
import { WebSocketService } from './WebSocketService';

function makeService(container: unknown): WebSocketService {
    const base = {
        configuration: { name: 'test-worker' },
    } as unknown as Base;
    return new WebSocketService(
        base,
        { delegates: [] },
        container as BaseInjectionContainer,
    );
}

describe('WebSocketService.buildWebSocketInfo', () => {
    it('populates WebSocketInfo.context from configured mappings', () => {
        const rcKey = { name: 'deviceId' };
        const base = {
            configuration: { name: 'test-worker' },
        } as unknown as Base;
        const service = new WebSocketService(
            base,
            {
                delegates: [],
                mappings: [
                    {
                        rcKey: rcKey as never,
                        wsKey: { name: 'deviceId' } as never,
                    },
                ],
            },
            {} as BaseInjectionContainer,
        );

        const request = {
            context: {
                get: (key: unknown) => (key === rcKey ? 'device-1' : undefined),
            },
        };

        const info = (
            service as unknown as {
                buildWebSocketInfo: (
                    request: unknown,
                    path: string,
                    socketId: string,
                ) => { context: Record<string, unknown> };
            }
        ).buildWebSocketInfo(request, '/ws/chat', 'socket-1');

        expect(info.context).toEqual({ deviceId: 'device-1' });
    });
});

describe('WebSocketService.getWebSocketInfo', () => {
    it('queries the delegate bridge (getWebSocketInfoFromSocket), not the socket-push client', async () => {
        const info = { path: '/ws/chat', socketId: 's1', context: {} };
        const getWebSocketInfoFromSocket = jest.fn().mockResolvedValue(info);
        class ChatDelegate {
            getWebSocketInfoFromSocket = getWebSocketInfoFromSocket;
        }
        const base = {
            configuration: { name: 'test-worker' },
        } as unknown as Base;
        const container = {
            resolve: (ctor: new () => unknown) => new ctor(),
        } as unknown as BaseInjectionContainer;
        const service = new WebSocketService(
            base,
            {
                delegates: [
                    {
                        name: 'chat',
                        path: '/ws/chat',
                        delegate: ChatDelegate as never,
                    },
                ],
            },
            container,
        );

        const result = await service.getWebSocketInfo('/ws/chat', 's1');

        expect(getWebSocketInfoFromSocket).toHaveBeenCalledWith('s1');
        expect(result).toBe(info);
    });
});

describe('WebSocketService.forwardErrorEventToSocketDelegate', () => {
    it('invokes the delegate onWebSocketError, looked up by path', async () => {
        const onWebSocketError = jest.fn();
        class ChatDelegate {
            onWebSocketError = onWebSocketError;
        }
        const base = {
            configuration: { name: 'test-worker' },
        } as unknown as Base;
        const container = {
            resolve: (ctor: new () => unknown) => new ctor(),
        } as unknown as BaseInjectionContainer;
        const service = new WebSocketService(
            base,
            {
                delegates: [
                    {
                        name: 'chat',
                        path: '/ws/chat',
                        delegate: ChatDelegate as never,
                    },
                ],
            },
            container,
        );

        // the socket's attachment carries a matching path (and a socketId that
        // must NOT be used for the delegate lookup)
        const webSocket = {
            deserializeAttachment: () => ({
                path: '/ws/chat',
                socketId: 'socket-123',
            }),
        };
        const errorEvent = {
            type: 'error',
            origin: 'test',
            errorType: 'Boom',
            message: 'boom',
        };

        await (
            service as unknown as {
                forwardErrorEventToSocketDelegate: (
                    ws: unknown,
                    event: unknown,
                ) => Promise<void>;
            }
        ).forwardErrorEventToSocketDelegate(webSocket, errorEvent);

        expect(onWebSocketError).toHaveBeenCalledTimes(1);
    });

    it('does not throw when the socket has no attached info (nowhere to route)', async () => {
        const onWebSocketError = jest.fn();
        class ChatDelegate {
            onWebSocketError = onWebSocketError;
        }
        const base = {
            configuration: { name: 'test-worker' },
        } as unknown as Base;
        const container = {
            resolve: (ctor: new () => unknown) => new ctor(),
        } as unknown as BaseInjectionContainer;
        const service = new WebSocketService(
            base,
            {
                delegates: [
                    {
                        name: 'chat',
                        path: '/ws/chat',
                        delegate: ChatDelegate as never,
                    },
                ],
            },
            container,
        );
        const webSocket = { deserializeAttachment: () => null };

        // before the fix this re-threw inside the error-reporting path
        await expect(
            (
                service as unknown as {
                    forwardErrorEventToSocketDelegate: (
                        ws: unknown,
                        event: unknown,
                    ) => Promise<void>;
                }
            ).forwardErrorEventToSocketDelegate(webSocket, {
                type: 'error',
                origin: 'test',
                errorType: 'Boom',
                message: 'boom',
            }),
        ).resolves.toBeUndefined();
        expect(onWebSocketError).not.toHaveBeenCalled();
    });
});

describe('WebSocketService with a missing socket attachment', () => {
    it('closes the socket instead of throwing on a message', async () => {
        const service = makeService({});
        const closed: Array<{ code: number; reason: string }> = [];
        const webSocket = {
            deserializeAttachment: () => null,
            close: (code: number, reason: string) =>
                closed.push({ code, reason }),
        } as unknown as BaseWebSocket;

        // a syntactically valid WebSocketEvent so we reach the info lookup
        await expect(
            service.webSocketMessage(
                webSocket,
                JSON.stringify({ type: 'ping' }),
            ),
        ).resolves.toBeUndefined();
        expect(closed).toEqual([
            { code: 1011, reason: 'Socket info not found.' },
        ]);
    });

    it('no-ops on close when there is no attached info', async () => {
        const service = makeService({});
        const webSocket = {
            deserializeAttachment: () => null,
        } as unknown as BaseWebSocket;
        await expect(
            service.webSocketClose(webSocket),
        ).resolves.toBeUndefined();
    });
});

describe('WebSocketService.connectCloudflareWorkerWebSocket', () => {
    it('does not let a client-supplied base-websocket-id header override the authorized identity', async () => {
        let forwardedHeaders: Record<string, string> = {};
        const delegate = {
            getDurableObjectForSocket: () => ({
                stub: {
                    fetch: (
                        _url: string,
                        init: { headers: Record<string, string> },
                    ) => {
                        forwardedHeaders = init.headers;
                        return new Response(null, { status: 200 });
                    },
                },
            }),
        } as unknown as WebSocketDelegate;

        // the client crafts its own base-websocket-id header trying to
        // impersonate another connection's identity
        const request = new Request('https://worker.example/ws/chat', {
            headers: {
                [BASE_HEADER_WEB_SOCKET_ID]: '/ws/chat:victim-socket',
            },
        }) as unknown as BaseRequest;

        const webSocketInfo = { path: '/ws/chat', socketId: 'attacker-socket' };

        const service = makeService({});
        await (
            service as unknown as {
                connectCloudflareWorkerWebSocket: (
                    request: BaseRequest,
                    webSocketInfo: unknown,
                    delegate: WebSocketDelegate,
                ) => Promise<Response>;
            }
        ).connectCloudflareWorkerWebSocket(request, webSocketInfo, delegate);

        // the framework's authorized identity must win over the client's header
        expect(forwardedHeaders[BASE_HEADER_WEB_SOCKET_ID]).toBe(
            '/ws/chat:attacker-socket',
        );
    });
});

describe('WebSocketService.connectWebSocketCloudflareDurableObject', () => {
    const originalWebSocketPair = (globalThis as { WebSocketPair?: unknown })
        .WebSocketPair;

    afterEach(() => {
        (globalThis as { WebSocketPair?: unknown }).WebSocketPair =
            originalWebSocketPair;
    });

    it('closes stale sockets on reconnect and never wipes Durable Object storage', async () => {
        // a client end and a server end; the server end takes the attachment
        (globalThis as { WebSocketPair?: unknown }).WebSocketPair = class {
            0 = {};
            1 = { serializeAttachment: () => {} };
        };

        const closedSockets: Array<{ code: number; reason: string }> = [];
        const staleSocket = {
            close: (code: number, reason: string) => {
                closedSockets.push({ code: code, reason: reason });
            },
        };

        let deleteAllCalls = 0;
        const durableObjectState = {
            getWebSockets: () => [staleSocket],
            acceptWebSocket: () => {},
            storage: {
                deleteAll: () => {
                    deleteAllCalls++;
                    return Promise.resolve();
                },
            },
        };

        const container = {
            resolve: (token: string) => {
                expect(token).toBe(
                    CloudflareInjections.DurableObjectState.toString(),
                );
                return durableObjectState;
            },
        };

        const request = new Request('https://worker.example/ws/chat', {
            headers: { 'base-request-route': '/ws/chat' },
        }) as unknown as BaseRequest;
        const webSocketInfo = { path: '/ws/chat', socketId: 'user-socket' };

        const service = makeService(container);
        // Response with status 101 is not constructible under Node's undici;
        // the behavior under test (no deleteAll, stale socket closed) happens
        // before that line, so tolerate a throw there and assert on the spies.
        try {
            await (
                service as unknown as {
                    connectWebSocketCloudflareDurableObject: (
                        request: BaseRequest,
                        webSocketInfo: unknown,
                    ) => Promise<Response>;
                }
            ).connectWebSocketCloudflareDurableObject(request, webSocketInfo);
        } catch {
            // ignore the 101-Response construction error under Node
        }

        expect(deleteAllCalls).toBe(0);
        expect(closedSockets).toHaveLength(1);
        expect(closedSockets[0]!.code).toBe(1000);
    });
});
