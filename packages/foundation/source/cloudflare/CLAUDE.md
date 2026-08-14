# cloudflare/ — Durable Objects & Containers

The Cloudflare-specific stateful primitives: **Durable Objects** (single-instance, stateful actors with storage + alarms + hibernatable WebSockets) and **Containers** (which run on top of Durable Objects). The pattern is the same on both sides: a class you author to _be_ the DO/container, and a binding + provider + inject decorator to _call_ one.

## Authoring a Durable Object

```ts
export class ChatRoom extends CfDurableObject {
    settings = chatRoomSettings; // a full BaseSettings (abstract member is protected; examples write it public)
}
```

`CfDurableObject` (`durable-object/core/CfDurableObject.ts`) extends Cloudflare's `DurableObject` (`cloudflare:workers`) and **runs a full Base app inside the DO**: it lazily creates its own `BaseWorker` from `settings` and registers the live `DurableObjectState` into the worker container (as `CloudflareInjections.DurableObjectState`) so DO-side services can reach durable storage. Requests, WebSocket events, and **alarms** all route through that inner `BaseWorker`/`Base` — `AlarmScheduledEvent` adapts a DO `alarm()` into a `ScheduledEvent` so it flows through `Base.handleScheduled` (this is the `'alarm'` branch of `ScheduledExecutableContext`, see [`scheduled/`](../scheduled/CLAUDE.md)).

DOs are **deployed as separate workers** (to avoid metadata cross-contamination between the main worker and the DO). `CfDurableObjectWorker` is the fetch-entry shim for that separate script: a no-op in production, but in development it forwards requests to the DO for local testing.

## Calling a Durable Object

```ts
class Rooms { static readonly Chat = new DurableObjectBinding<ChatRoomRpc>('CHAT_ROOM') }

constructor(@InjectDurableObjectProvider(Rooms.Chat) private rooms: CfDurableObjectProvider<ChatRoomRpc>) {}

const handle = this.rooms.getDurableObject({ name: 'room-42' })   // or { id: '<64-char id>' }; omit for newUniqueId()
await handle.rpc.call().postMessage(msg)
```

- **`DurableObjectBinding<RpcInterface>`** — a `TypedBinding` matching the DO namespace binding in `wrangler.toml`, carrying the DO's RPC interface type.
- **`@InjectDurableObjectProvider(binding)`** — injects a `CfDurableObjectProvider<RpcInterface>` (lint-checked against the param type).
- **`CfDurableObjectProvider`** — resolves a `CfDurableObjectHandle` for a `CfDurableObjectInput` (`id` **xor** `name` — `id` → `idFromString`, `name` → `idFromName`). The handle bundles the `binding`, the raw `stub`, and a typed `RpcClient<RpcInterface>` (over a `FetcherRpcClientDriver`), so you talk to the DO via the same RPC mechanism as any service (see [`rpc/`](../rpc/CLAUDE.md)).
- **`CfDurableObjectSettings`** (`BaseSettings.durableObjects`) — `{ namespace, rpcEndPoint? }`.

## Containers (`durable-object/container/`)

Parallel API for Cloudflare Containers (which sit on Durable Objects). `CfContainer` re-exports `Container` from `@cloudflare/containers`; `CfContainerWorker` is the entry shim; and the call side mirrors DOs: `ContainerBinding` + `@InjectContainerProvider` → `CfContainerProvider` → `CfContainerHandle`. Configured via `BaseSettings.containers`.

## Injections

`CloudflareInjections` (`CloudflareInjections.ts`) — `DurableObjectState` is a `TypedInjectionKey<DurableObjectState>` available when running in the `CloudflareDurableObject` platform, giving DO-side code access to the durable state/storage.

## See also

[`web-socket/`](../web-socket/CLAUDE.md) (DO-hosted sockets) · [`scheduled/`](../scheduled/CLAUDE.md) (DO alarms) · [`rpc/`](../rpc/CLAUDE.md) (how DO calls travel) · [`base/`](../base/CLAUDE.md) (the inner `BaseWorker`).

**wrangler notes for ORM-backed DOs:** declare the class under `[[migrations]] new_sqlite_classes` (not `new_classes` — that is for plain-KV DOs), and add a `[[rules]] type = "Text", globs = ["**/*.sql"]` block so the bundled migrations barrel can import `.sql` files as text. Caller-side settings use `rpcEndPoint` (capital P) — unlike `WebSocketDelegateSettings.rpcEndpoint`.
