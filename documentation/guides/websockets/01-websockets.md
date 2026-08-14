---
title: Use WebSockets
description: Mount a socket delegate on a path, authorize upgrades, and push typed events to connected clients.
---

WebSockets in Base are handled by **delegates**: a class per socket endpoint that authorizes connections and reacts to socket lifecycle. On Cloudflare, each connection is backed by a Durable Object, so sockets survive worker restarts (hibernation) without you managing any of it.

## Write a delegate

Extend the abstract `WebSocketDelegate`. Three methods are required; two are optional:

```ts
import { RequestContext } from '@system-inc/base-foundation/request/RequestContext';
import { WebSocketDelegate } from '@system-inc/base-foundation/web-socket/WebSocketDelegate';
import {
    BaseWebSocket,
    WebSocketInfo,
} from '@system-inc/base-foundation/web-socket/WebSocketTypes';

export class ChatDelegate extends WebSocketDelegate {
    // Decide whether to accept the upgrade. Return a socket id to accept,
    // undefined to reject with 401.
    async authorizeUpgrade(
        request: RequestContext,
    ): Promise<string | undefined> {
        const sessionId = request.cookies['sessionId'];
        if (!sessionId) {
            return undefined;
        }
        return crypto.randomUUID();
    }

    async onWebSocketClose(
        webSocket: BaseWebSocket,
        socketInfo: WebSocketInfo,
    ): Promise<void> {
        // presence cleanup, notify the room, ...
    }

    async onWebSocketError(
        webSocket: BaseWebSocket,
        socketInfo: WebSocketInfo,
        error: WebSocketErrorEvent,
    ): Promise<void> {
        console.warn('socket error', socketInfo.socketId);
    }
}
```

The optional hooks: `populateSocketContext(info, socketId)` seeds per-socket context values on first use, and `onWebSocketEvent(webSocket, info, event)` receives non-RPC events sent over the socket.

## Mount it

Delegates are registered in settings (worker-level `webSocket`, or contributed by a module):

```ts
    webSocket: {
        delegates: [
            { name: 'chat', path: '/ws/chat', delegate: ChatDelegate },
        ],
    },
```

Each delegate gets a GET route at its `path`. The connection flow: a standard WebSocket upgrade hits the path → no delegate is a 404, a non-upgrade request is a 426 → your `authorizeUpgrade` runs: `undefined` rejects with 401, a socket id accepts. Clients are ordinary platform WebSockets, browser or otherwise:

```ts
const socket = new WebSocket('wss://app.example.com/ws/chat');
```

(There's no client library to install — the platform `WebSocket` is the client.)

## Push to a connected socket

The delegate base class provides the send-side tools, keyed by socket id:

```ts
// fire an event down the socket
await this.emitEventOnSocket(
    { type: 'chat-message', arguments: [payload] },
    socketId,
);

// or make typed RPC-style pushes via a client bound to that socket
const client =
    this.getRemoteProcedureClientForSocket<ChatClientInterface>(socketId);
await client.call().receiveMessage(payload);
```

On Cloudflare each socket lives in its own Durable Object (keyed by the socket id); the delegate's helpers route through it transparently, worker-side or DO-side.

## Session context on sockets

Modules can map request-context values onto the socket's context at connect time — this is how a socket knows which session opened it:

```ts
    webSocket: {
        mappings: [
            { rcKey: SessionIdRequestContextKey, wsKey: SessionIdWebSocketInfoKey },
        ],
    },
```

Read them back anywhere you hold the `WebSocketInfo` with `getWsContext(info, key)`; write your own in `populateSocketContext` with `setWsContext`. The `WebSocketInfo` (`socketId`, `path`, `context`) follows the socket everywhere, including into RPC procedures invoked over it.
