# rpc/ — RPC (server side + foundation client)

Typed procedure calls between workers over the BaseRPC protocol. This folder is the **server side** (define services, dispatch incoming calls) plus the **foundation-side client wiring** (inject a typed client bound to another worker). The wire protocol and the base transport live elsewhere: protocol in [`base-common/rpc/protocol`](../../../common/CLAUDE.md), transport `RpcClient` in [`base-client`](../../../client/CLAUDE.md). Dispatch engine: `internal/rpc/RpcDispatcher.ts`.

## Server: defining a service

```ts
@RpcService({ visibility: 'internal' })
export class BillingRpc {
  @Rpc()
  async charge(@RpcArgument(() => ChargeInput) input: ChargeInput): Promise<ChargeResult> { ... }

  @WebSocketRpc()                       // ws push; must return Promise<void>
  async subscribe(@RpcArgument(() => String) topic: string): Promise<void> { ... }
}
```

List the class in a module's (or the worker's) `services` — its `@RpcService` decorator sorts it into the RPC surface. Procedure names must be unique across a worker's registered RPC services, because a call names only the procedure: two registered services declaring the same name fail boot (`BaseAppManifest.validate()`), naming both classes. `@RpcService(options?)` marks the class (`DecoratorRegistry` + RPC metadata); `options.visibility` sets service-level visibility. `@Rpc(returnType?, options?)` (or `@Rpc(options)`) marks a method as a remote procedure; the optional `TypeFunc` drives result serialization (bare `@Rpc()` returns plain JSON), and `options.visibility` overrides visibility for that one procedure. (Procedure renaming and description options were deliberately dropped: a renamed procedure would fall out of the shared-interface typing, and descriptions belong in TSDoc.) `@RpcArgument(typeFunc, options?)` describes an argument — the `TypeFunc` is **required**; it drives deserialization and, for class types, validation. An undecorated parameter receives the raw JSON as-is. `@WebSocketRpc()` marks a procedure a client calls over a live WebSocket (fire-and-forget; the `Promise<void>` return constraint is compile-time). Socket-only access **is** enforced at runtime — see _Visibility_.

`Base` serves the service on a POST route at `rpcServer.route ?? DefaultRpcEndpoint` and defers to the lazy `RpcDispatcher`.

## Server: dispatch (`internal/rpc/RpcDispatcher.ts`)

`handleRequest(request)` parses/validates the incoming `RpcCall` (from `base-common/rpc/protocol`) and hands it to `dispatch(rpc, request)`, which returns the `RpcResult` the route serializes. `dispatch` is the one entry point for running a procedure, so any surface built on it gets identical enforcement. Per call, `dispatch`:

1. looks the procedure up in an index built (at dispatcher construction) from the **registered** RPC services only — defined ≠ callable, so a decorated service that's imported but not listed in `services` can never shadow or serve a procedure; unknown → `rpcErrorNotFound`. Only methods declared with `@Rpc()` / `@WebSocketRpc()` are indexed: `@RpcArgument` alone records argument metadata but never makes a method callable;
2. enforces visibility/`allowedWorkers`;
3. resolves the service from the request container, sets `rc.handler`, and runs handler middleware — access control first, deliberately **before** argument deserialization so an unauthenticated caller can't exercise deserialization/validation ahead of the auth check. A session-access denial is **thrown** (a `BaseError` with `AUTHENTICATION_REQUIRED`, `PERMISSION_DENIED`, or `INSUFFICIENT_ENTITLEMENTS` — on the RPC route, the HTTP 401/403 itself), while any other middleware short-circuit becomes a `NOT_ALLOWED` failure, so callers of `dispatch` can tell them apart;
4. for each declared `@RpcArgument`, **deserializes** the raw JSON to the typed param (`serialization/Deserialize`) and, when it's a class type, runs `validate()` — failures become an `RPC_ERROR_CODE_VALIDATION_ERROR` carrying an `ArgumentValidationError` (same validation path as HTTP/GraphQL — see [`validation/`](../validation/CLAUDE.md)); resolves `@InjectRequestContext()` params;
5. invokes the method and **serializes** the result into an `RpcSuccess`, or maps thrown errors through `BaseError.forClient` (masking internals) into an `RpcFailure` with the right `RpcErrorCode` (`NOT_ALLOWED`, `INTERNAL_ERROR`, `VALIDATION_ERROR`). The failure's `cause` is the full error record, stack included, only for an `'internal'` caller (a bound worker); everyone else gets the client-safe `toJSON()` shape — no stack, database messages redacted.

### Visibility (`RpcVisibility`)

`'public'` — callable from a public route. `'internal'` (default) — callable only from a **bound worker**; `RpcServiceSettings.allowedWorkers` lists which caller worker **names** may call in. Precedence, most specific wins: per procedure (`@Rpc({ visibility })`) → per service (`@RpcService(options)`) → the worker's `rpc.service` settings. In local development mode everything is effectively `'public'`.

The caller's identity is `RequestContext.routing` (`BaseRequestContext.resolveRouting`), built only from facts a client can't forge:

- **`'internal'`** — the `<worker>.base-internal` hostname a service binding / Durable Object stub delivers, trusted **on Cloudflare only** (on Node the hostname is the client's `Host` header, so it's always `'public'` there; `BaseWorkerNodeRunner` pins `PLATFORM=Node`).
- **`'websocket'`** — an RPC a client sent over a socket: flagged by `WebSocketService` when it dispatches (never from the client's message), or relayed by a bound worker carrying the `base-websocket-fetch` header (`origin` = the relaying worker). A header can only downgrade a bound caller, so it's ignored on public requests.

A `'websocket'` caller reaches `@WebSocketRpc()` procedures and `'public'` ones — never `'internal'`, whoever relays it. `@WebSocketRpc()` procedures accept nothing else (HTTP callers get `NOT_ALLOWED`), and a relayed call must come from a worker on `allowedWorkers`. `RpcCall.meta` (the relayed socket's `WebSocketInfo`) is adopted only from such an allowed relay; from anyone else it's ignored, since a body field would let the caller claim any socket's identity and context.

## Client: calling another worker's service

```ts
class StripeBindings { static readonly Billing = new RpcClientBinding<BillingRpc>('BILLING') }

constructor(@InjectRpcClient(StripeBindings.Billing) private billing: RpcClient<BillingRpc>) {}
await this.billing.call().charge(input)
```

- **`RpcClientBinding<RpcInterface>`** — a `TypedBinding` whose name matches an `rpc.client` settings entry's `name`; that entry's per-environment `binding` is what names the Cloudflare service binding in `wrangler.toml`. The generic threads the remote service's type through so `@InjectRpcClient` returns a typed `RpcClient<RpcInterface>`.
- **`@InjectRpcClient(binding)`** — injects a client via `injectWithTransform` over `RpcClientFactory`.
- **`RpcClientFactory`** (`client/RpcClientFactory.ts`) — builds an `RpcClient` from the worker's `rpc.client` settings (matched by `name`), picking a driver per environment.

### Drivers (foundation adds two to base-client's set)

| Driver                     | Transport                                                           | Source      |
| -------------------------- | ------------------------------------------------------------------- | ----------- |
| `FetchRpcClientDriver`     | global `fetch` to a host                                            | base-client |
| `FetcherRpcClientDriver`   | a Cloudflare service-binding `Fetcher` (preferred on Cloudflare)    | this folder |
| `WebSocketRpcClientDriver` | forwards RPCs over an existing `BaseWebSocket` as forwarding events | this folder |

### Client settings (`RpcClientSettings`)

Per service: a `name` (used to inject) and `environments` (`NamedConfiguration`) that must specify either a `binding` (the Cloudflare service binding — preferred) **or** a `host` (with optional `endpoint`, `secure`). Binding is used on Cloudflare; host is the fallback off-Cloudflare.

## Relationship to base-client

Foundation **defines and dispatches** services and constructs clients; `base-client` provides the protocol-agnostic `RpcClient` + `RpcClientDriver` base and the plain-fetch driver; `base-common` defines the shared wire protocol. Foundation's contribution on the client side is the Cloudflare-specific drivers (service-binding `Fetcher`, WebSocket) and the DI-friendly factory/binding/inject decorator.

## See also

[`base-client`](../../../client/CLAUDE.md) · [`web-socket/`](../web-socket/CLAUDE.md) (WebSocket RPC) · [`serialization/`](../serialization/CLAUDE.md) · [`router/`](../router/CLAUDE.md) (shared `RequestContext`).
