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

List the class in a module's (or the worker's) `services` — its `@RpcService` decorator sorts it into the RPC surface. `@RpcService(options?)` marks the class (`DecoratorRegistry` + RPC metadata); `options.visibility` sets service-level visibility. `@Rpc(returnType?, options?)` (or `@Rpc(options)`) marks a method as a remote procedure; the optional `TypeFunc` drives result serialization (bare `@Rpc()` returns plain JSON), and `options.visibility` overrides visibility for that one procedure. (Procedure renaming and description options were deliberately dropped: a renamed procedure would fall out of the shared-interface typing, and descriptions belong in TSDoc.) `@RpcArgument(typeFunc, options?)` describes an argument — the `TypeFunc` is **required**; it drives deserialization and, for class types, validation. An undecorated parameter receives the raw JSON as-is. `@WebSocketRpc()` marks a push procedure intended for delivery over a live WebSocket; the `Promise<void>` return constraint is compile-time only (the dispatcher does not enforce socket-only at runtime).

`Base` serves the service on a POST route at `rpcServer.route ?? DefaultRpcEndpoint` and defers to the lazy `RpcDispatcher`.

## Server: dispatch (`internal/rpc/RpcDispatcher.ts`)

Per call, the dispatcher:

1. parses/validates the incoming `RpcCall` (from `base-common/rpc/protocol`);
2. looks up the service + procedure in RPC metadata; unknown → `rpcErrorNotFound`;
3. enforces visibility/`allowedWorkers`, then rejects services not listed in `services` settings — defined ≠ callable;
4. resolves the service from the request container, sets `rc.handler`, and runs handler middleware — access control first, deliberately **before** argument deserialization so an unauthenticated caller can't exercise deserialization/validation ahead of the auth check;
5. for each declared `@RpcArgument`, **deserializes** the raw JSON to the typed param (`serialization/Deserialize`) and, when it's a class type, runs `validate()` — failures become an `RPC_ERROR_CODE_VALIDATION_ERROR` carrying an `ArgumentValidationError` (same validation path as HTTP/GraphQL — see [`validation/`](../validation/CLAUDE.md)); resolves `@InjectRequestContext()` params;
6. invokes the method and **serializes** the result into an `RpcSuccess`, or maps thrown errors through `BaseError.forClient` (masking internals) into an `RpcFailure` with the right `RpcErrorCode` (`NOT_ALLOWED`, `INTERNAL_ERROR`, `VALIDATION_ERROR`).

### Visibility (`RpcVisibility`)

`'public'` — callable from a public route. `'internal'` (default) — callable only from a **bound worker**; `RpcServiceSettings.allowedWorkers` lists which caller worker **names** may call in. Precedence, most specific wins: per procedure (`@Rpc({ visibility })`) → per service (`@RpcService(options)`) → the worker's `rpc.service` settings. In local development mode everything is effectively `'public'`.

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
