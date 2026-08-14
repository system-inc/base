---
title: Call a Worker from the Web
description: Typed RPC calls from a browser with @system-inc/base-client, covering options, retries, and error handling.
---

`@system-inc/base-client` is a small transport package for browsers (and workers): construct a client with your service's interface, and every call is checked by TypeScript against the server's own contract.

## Construct a client

```ts
import { FetchRpcClientDriver } from '@system-inc/base-client/rpc/client/driver/FetchRpcClientDriver';
import { RpcClient } from '@system-inc/base-client/rpc/client/RpcClient';
import { NoteServiceInterface } from './NoteServiceInterface';

const driver = new FetchRpcClientDriver('api.example.com', { secure: true });
const client = new RpcClient<NoteServiceInterface>(driver);
```

The generic is the whole trick: `NoteServiceInterface` is the same interface your worker's service `implements` ([Share Types](./03-share-types.md)), so procedure names, argument lists, and return types are all statically checked.

## Make calls

`client.call()` returns the interface itself — call procedures like local methods:

```ts
const note = await client.call().getNote(id);

const created = await client
    .call()
    .createNote({ title: 'From the browser', content: 'Typed end to end.' });
```

Per-call options ride in `call(options)`:

```ts
const result = await client
    .call({
        credentials: 'include', // send the session cookie cross-origin
        headers: { 'x-request-source': 'web' },
        retry: { maxAttempts: 5 },
    })
    .getNote(id);
```

Retries default to 3 attempts with jittered backoff, retrying transient network failures and 502/503 responses — tune or disable via `retry`.

## Handle errors

A failed procedure throws an `RpcError` carrying a structured code:

```ts
import { RpcError } from '@system-inc/base-client/rpc/client/error/RpcError';
import {
    RPC_ERROR_CODE_NOT_FOUND,
    RPC_ERROR_CODE_VALIDATION_ERROR,
} from '@system-inc/base-common/rpc/protocol/RpcErrorCode';

try {
    await client.call().createNote(input);
} catch (error) {
    if (error instanceof RpcError) {
        if (error.code === RPC_ERROR_CODE_VALIDATION_ERROR) {
            // input failed the server's validation decorators
        }
        console.warn(error.procedure, error.code, error.message);
    }
}
```

Two details worth knowing:

- **Unexpected server errors arrive masked.** A handler that throws an unknown error surfaces to the client as `RPC_ERROR_CODE_INTERNAL_ERROR` with `'Internal server error'` — internals are logged server-side, never leaked to callers.
- **Need the envelope?** `client.callProcedure('getNote', [id], options)` skips the proxy and returns the full response (`status`, call `id`, `durationMs`, and the underlying `http` status) useful for instrumentation.

## Server prerequisites

For browser calls, the worker needs `rpc: { service: { visibility: 'public' } }` and a [CORS allowlist](../http/06-cors.md) that admits your web origin — with `allowCredentials: true` if you send cookies. RPC rides the normal router (`POST /__rpc`), so the same CORS policy covers it.
