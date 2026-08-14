# test/ — integration test client

Transport plumbing for integration tests that run against a **live worker** (started by the CLI's `base test` command). Generic only — module-specific helpers (account setup, device cookies, etc.) live with their modules and wrap an instance of this client.

## Pieces

- **`IntegrationTestClient`** — talks to the server under test over its real surfaces: builds GraphQL (`graphql-request`), RPC (`RpcClient` over `FetchRpcClientDriver`), and WebSocket (`ws`) clients against the configured host, manages a cookie jar across requests, and exposes the Orm database (`getOrmDatabase()`) for DB assertions. URL helpers target `/graphql` and `/__rpc`. HTTP/GraphQL fetches retry on **transport** failures only (`ECONNRESET`-class errors — never on an HTTP response, however bad the status, so real failures stay visible; every retry is logged). Set `TEST_DISABLE_HTTP_KEEP_ALIVE=true` to send `Connection: close` per request — sidesteps the undici keep-alive race against a locally booted workerd.
- **`IntegrationTestEnvironment`** — the runtime config (e.g. `host`) the client builds against.
- **`IntegrationTestGraphQL`** — GraphQL test helpers.
- **`IntegrationTestIds`** — stable id helpers for fixtures.
- **`JestSetup`** — Jest setup hooks.

## How it runs

`base test [worker]` runs the integration suite against an already-running worker — it does not boot one; run `base develop` in another shell or target a deployed environment (see the [cli doc](../../../cli/CLAUDE.md)); `BaseSettings.moduleTest` opts modules into having their integration tests run. The client is the shared low-level transport those tests build on.

## See also

[`base-client`](../../../client/CLAUDE.md) (the `RpcClient` it uses) · [cli](../../../cli/CLAUDE.md) (`test` command).
