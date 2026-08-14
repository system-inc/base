---
title: Worker-to-Worker Calls
description: Inject a typed client bound to another worker over Cloudflare service bindings, with no public exposure.
---

Workers call each other the same way the web calls them: a typed `RpcClient` over the shared interface. The difference is wiring — on Cloudflare the call travels over a **service binding** (worker-to-worker, never leaving the platform), and the callee stays `internal`.

## 1. Declare the client in the caller's settings

Each downstream worker the caller talks to gets an entry in the caller's `rpc.client` list, keyed by a name you choose:

```ts
    rpc: {
        client: [
            {
                name: 'BILLING',
                environments: {
                    '@default': { binding: 'BILLING_SERVICE' },
                },
            },
        ],
    },
```

`binding` names a Cloudflare **service binding** declared in the caller's `wrangler.toml` for each environment:

```toml
[env.Production]
name = "checkout"
services = [{ binding = "BILLING_SERVICE", service = "billing" }]
```

For non-Cloudflare targets (or local setups without bindings), give the environment a `host` instead — the client falls back to plain HTTPS against that host's `/__rpc`.

## 2. Bind and inject a typed client

Declare a `RpcClientBinding` typed with the downstream service's shared interface, then inject:

```ts
import { BillingServiceInterface } from '@your-app/shared/BillingServiceInterface';

import { RpcClient } from '@system-inc/base-client/rpc/client/RpcClient';
import { Injectable } from '@system-inc/base-foundation/dependency-injection/decorators/Injectable';
import { InjectRpcClient } from '@system-inc/base-foundation/rpc/decorators/InjectRpcClient';
import { RpcClientBinding } from '@system-inc/base-foundation/rpc/RpcClientBinding';

export class WorkerBindings {
    static readonly Billing = new RpcClientBinding<BillingServiceInterface>(
        'BILLING',
    );
}

@Injectable()
export class CheckoutService {
    constructor(
        @InjectRpcClient(WorkerBindings.Billing)
        private readonly billing: RpcClient<BillingServiceInterface>,
    ) {}

    async charge(input: ChargeJson): Promise<ChargeResultJson> {
        return await this.billing.call().charge(input);
    }
}
```

The binding string (`'BILLING'`) matches the `rpc.client` entry's `name` — that entry's per-environment config decides the transport. Same interface file as every other caller ([Share Types](./03-share-types.md)); the call site reads like a local method.

## 3. Allow the caller on the callee

The callee keeps the default `internal` visibility and lists which workers may call in — by caller worker **name**:

```ts
// billing worker's settings.ts
rpc: {
    service: {
        visibility: 'internal',
        allowedWorkers: ['checkout'],
    },
},
```

Calls over a service binding identify their origin worker; anyone not on the list is rejected before your handler runs. A worker serving both browsers and workers can set `visibility: 'public'` — internal callers still ride the binding.

## Why this beats `fetch` between workers

- **Typed end to end**: the shared interface checks the call at compile time.
- **No public surface**: service bindings never traverse the public internet, and `internal` visibility plus `allowedWorkers` makes the access policy explicit and reviewed.
- **Uniform error handling**: failures arrive as the same structured `RpcError` your frontend code handles.
