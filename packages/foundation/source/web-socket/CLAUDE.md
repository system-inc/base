# web-socket/ — WebSockets

WebSocket endpoints backed by a delegate per path, with platform implementations for Cloudflare (Durable-Object-hosted, hibernatable sockets) and Node (a `ws` server). The public surface is here; the orchestrator is `internal/web-socket/WebSocketService`.

## Defining an endpoint

A `WebSocketDelegate` (abstract) handles connections for one endpoint. Its constructor is `(namespace: string, configuration: BaseConfiguration)`; subclasses implement three abstract methods — `authorizeUpgrade(request)` (return a socket id to accept, `undefined` → 401), `onWebSocketClose(socket, info)`, `onWebSocketError(socket, info, error)` — plus optional `populateSocketContext(info, socketId)` and `onWebSocketEvent(socket, info, event)`. There is no `onConnect`/`onMessage`. Register it via a module's `webSocket.delegates`:

```ts
{ name: 'chat', path: '/ws/chat', delegate: ChatDelegate, rpcEndpoint?: '/rpc' }
```

`Base.initializeWebSocketRoutes` creates a **GET route per delegate path** that calls `WebSocketService.connectSocket`. Incoming socket lifecycle events (`webSocketMessage` / `Close` / `Error`, plus Node-only `Register` / `Unregister`) flow from `Base` into `WebSocketService`, which dispatches to the right delegate. A delegate can reach a Durable Object (`durableObjectProvider`) and issue RPCs over the socket.

## `WebSocketInfo` — connection state on the wire

`WebSocketInfo` (`socketId`, `path`, `context`) travels with every message and **across workers / Durable Objects**, so it must stay JSON-serializable. Read/write its `context` bag through typed `WebSocketInfoKey`s via `getWsContext` / `setWsContext` (which also accept a `RequestContext` that carries the info, for middleware).

**`WebSocketContextMapping`** (module `webSocket.mappings`, aggregated by `BaseAppManifest`) copies values from the `RequestContext` into `WebSocketInfo.context` at connect time — so per-request values (device id, session) are available to later socket messages without re-running the HTTP-path middleware.

## Platform implementations

| Folder        | Pieces                                                            | Notes                                                                                                                                           |
| ------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `cloudflare/` | `DurableObjectWebSocketBridge`, `DurableObjectWebSocketRpcClient` | On Cloudflare the socket is owned by a Durable Object (enabling hibernation); the worker bridges to it, and RPCs can be driven over that socket |
| `node/`       | `NodeWebSocketServer`, `NodeWebSocketWrapper`                     | A `ws`-based server for the Node target; this is why `Register`/`Unregister` exist (Node-only)                                                  |

`BaseWebSocket` is the platform-agnostic socket type (`NodeWebSocket` aliases `ws`'s `WebSocket`).

## WebSocket RPC

A delegate's `rpcEndpoint` plus the `WebSocketRpcClientDriver` (see [`rpc/`](../rpc/CLAUDE.md)) let RPC calls be forwarded over a live socket as forwarding events — and `@WebSocketRpc()` marks procedures that are callable only this way (return `Promise<void>`).

## Settings (`WebSocketSettings`)

`delegates` (`WebSocketDelegateSettings[]`: `name`, `path`, `delegate`, optional `rpcEndpoint`) and `mappings` (populated from modules — usually not set by hand).

## See also

[`rpc/`](../rpc/CLAUDE.md) (WebSocket RPC) · [`cloudflare/`](../cloudflare/CLAUDE.md) (Durable Objects) · [`router/`](../router/CLAUDE.md) (`RequestContext` the mappings read from).
