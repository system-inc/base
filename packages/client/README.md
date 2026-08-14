# `@system-inc/base-client`

The client side of the BaseRPC protocol: a small, fetch-based RPC client plus HTTP-error handling, safe to run in **browsers and Cloudflare Workers**. Lets a consumer call procedures on a [`@system-inc/base-foundation`](../foundation/README.md) server in a typed way. Zero reflection, zero decorators — its only dependency is [`@system-inc/base-common`](../common/README.md).

```bash
npm install @system-inc/base-client
```

## Usage

No barrel files — import the exact module:

```ts
import { FetchRpcClientDriver } from '@system-inc/base-client/rpc/client/driver/FetchRpcClientDriver';
import { RpcClient } from '@system-inc/base-client/rpc/client/RpcClient';

const driver = new FetchRpcClientDriver('example.com', { secure: true });
const client = new RpcClient<MyRpcInterface>(driver);

const result = await client
    .call({ retry: { maxAttempts: 5 } })
    .myProcedure(arg1, arg2);
```

Provides typed calls (a Proxy DSL checked against your `RpcInterface`), pluggable transport drivers, built-in retry/backoff, and two error layers — `HttpError` (transport) and `RpcError` (application). The wire protocol itself lives in [`base-common/rpc/protocol`](../common/source/rpc/protocol/CLAUDE.md); the server side lives in `base-foundation`.

See [`CLAUDE.md`](./CLAUDE.md) for the design and full API.

---

Part of the [Base](../../README.md) monorepo.
