# @system-inc/base-client

The **client side** of the BaseRPC protocol: a small, fetch-based RPC client plus HTTP-error handling, safe to run in browsers and Cloudflare Workers. Depends only on `base-common`.

## Purpose

Lets a consumer (browser app, edge worker, another service) call procedures on a `base-foundation` server in a typed way over HTTP. It implements the _transport and error handling_ for the RPC protocol whose wire types live in `@system-inc/base-common/rpc/protocol/*`. The server side (defining and dispatching RPC services) lives in `foundation`; this package only consumes those services.

## How it's consumed

No barrel — import the concrete files:

```ts
import { FetchRpcClientDriver } from '@system-inc/base-client/rpc/client/driver/FetchRpcClientDriver';
import { RpcClient } from '@system-inc/base-client/rpc/client/RpcClient';

const driver = new FetchRpcClientDriver('example.com', { secure: true });
const client = new RpcClient<MyRpcInterface>(driver);
const result = await client
    .call({ retry: { maxAttempts: 5 } })
    .myProcedure(arg1, arg2);
```

`@system-inc/base-client/rpc/client/RpcClient` is imported ~10× across the repo (foundation injects it for service-to-service calls).

## Design choices

- **Protocol shared, not duplicated.** Request/response types (`RpcCall`, `RpcSuccess`, `RpcFailure`, `RpcErrorCode`, `DefaultRpcEndpoint`) come from `base-common`. Both client and server speak BaseRPC 1.0 over an HTTP `POST` to a single endpoint (`/__rpc` by default).
- **Driver abstraction.** An abstract `RpcClientDriver` defines `buildRequest` / `sendRequest` / `handleResponse`. Two implementations:
    - `FetchRpcClientDriver` — uses the global `fetch`.
    - `FetchableRpcClientDriver` — takes an injected `Fetchable` (from `common`), for Workers or custom-fetch environments.
- **Typed call DSL.** `RpcClient` uses a Proxy so `client.call(opts).someProcedure(args)` is type-checked against the `RpcInterface` generic; `callProcedure(name, args, opts)` is the untyped escape hatch.
- **Two error layers.** `HttpError` (transport: status, headers, parsed `BaseErrorData`) and `RpcError` (application: failure `code`, procedure, id). Non-200 responses → `HttpError`; `status: 'failure'` responses → `RpcError`.
- **Retry with backoff.** Configurable per call (`maxAttempts` 1–10, min/max backoff, jitter). Defaults retry network drops and HTTP 502/503; `isRetryable(error)` allows custom policy.
- **Browser/edge-safe by design.** Zero reflection, zero decorators, no Node APIs — only `fetch`, `crypto.randomUUID`, and Fetch API types. This is _why_ it's a separate package from `foundation`.

## Major files

| File                                                   | Purpose                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `source/rpc/client/RpcClient.ts`                       | Main client: Proxy DSL, retry loop, id generation                               |
| `source/rpc/client/driver/RpcClientDriver.ts`          | Abstract driver: request build + response parse/validate                        |
| `source/rpc/client/driver/FetchRpcClientDriver.ts`     | Driver over global `fetch`                                                      |
| `source/rpc/client/driver/FetchableRpcClientDriver.ts` | Driver over an injected `Fetchable`                                             |
| `source/rpc/client/interfaces/`                        | `RpcCallOptions`, `RpcClientOptions`, `RpcClientResult`, `RpcClientIdGenerator` |
| `source/rpc/client/error/RpcError.ts`                  | RPC-failure error + `RpcClientErrorHandling` constructors                       |
| `source/error/HttpError.ts`                            | HTTP error + `httpErrorFromResponse` / `httpErrorFromJson`                      |

## Relationship to other packages

- → `base-common`: shares the RPC protocol, `BaseErrorSerializer`, HTTP utilities.
- ← `base-foundation`: foundation injects an `RpcClient` (e.g. via an inject decorator) so services can call remote procedures. No cycle: `client → common`, `foundation → client → common`.
