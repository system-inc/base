# rpc/protocol/ — the BaseRPC wire contract

The single source of truth for the RPC wire format, shared by **both** sides so neither redefines it: [`base-client`](../../../../client/CLAUDE.md) implements the transport against these types, and [`base-foundation`](../../../../foundation/CLAUDE.md)'s `RpcDispatcher` implements the server against them. Pure JSON-serializable types — no logic, no dependencies.

## The types

- **`RpcEnvelope<Metadata>`** — common fields on every message: `id`, protocol/version, optional `metadata`.
- **`RpcCall`** (`type: 'request'`) — a call: `procedure` (name) + `arguments` (a `JsonArray`). `isRpcCall(obj)` guards it.
- **`RpcResponse`** (`type: 'response'`) — `status: 'success' | 'failure'`, optional server `durationMs`. Narrowed to:
    - **`RpcSuccess<TResult>`** — `status: 'success'` + `result`.
    - **`RpcFailure`** — `status: 'failure'` + error info (a `BaseErrorData`) + an `RpcErrorCode`.
- **`RpcErrorCode`** — the closed set: `NOT_FOUND`, `NOT_ALLOWED`, `MALFORMED_RESPONSE`, `VALIDATION_ERROR`, `INTERNAL_ERROR`.
- **`DefaultRpcEndpoint`** — `'/__rpc'`, the default route both sides use.

## Transport

BaseRPC is carried as a single JSON `POST` to the endpoint: the body is an `RpcCall`, the reply is an `RpcResponse`. HTTP-200-only means success; the `RpcFailure.status`/`code` carry application failures (the transport-vs-application error split is handled in `base-client`).

## Who implements it

- **Client** ([`base-client`](../../../../client/CLAUDE.md)) — `RpcClient` + drivers build `RpcCall`s and parse `RpcResponse`s.
- **Server** ([`base-foundation` `rpc/`](../../../../foundation/source/rpc/CLAUDE.md)) — `RpcDispatcher` parses `RpcCall`s, runs the procedure, and emits `RpcSuccess`/`RpcFailure` (mapping thrown errors to the right `RpcErrorCode`).

Change a type here and both packages must agree — that's the point of it living in `common`.
