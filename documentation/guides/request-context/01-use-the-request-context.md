---
title: Use the RequestContext
description: One object per request, carrying identity, headers, cookies, response writing, deferred work, and typed state.
---

Every dispatched event carries a `RequestContext`: one object holding everything about the in-flight request. It's the same context in HTTP handlers, GraphQL resolvers, and RPC procedures, so middleware written against it works across all three.

## Get it

Inject it into any handler parameter:

```ts
import { InjectRequestContext } from '@system-inc/base-foundation/request/decorators/RequestContextDecorator';
import { RequestContext } from '@system-inc/base-foundation/request/RequestContext';

    @HttpRoute('GET', '/whoami')
    whoami(@InjectRequestContext() context: RequestContext): Response {
        return Response.json({
            requestId: context.requestId,
            userAgent: context.userAgent,
        });
    }
```

## What's on it

Framework-owned fields are `readonly`, because the context is a view, not a grab bag:

| Field                                   | What it is                                                       |
| --------------------------------------- | ---------------------------------------------------------------- |
| `requestId`                             | unique id for this request; correlate logs with it               |
| `url`, `method`, `route`                | what was called and which route matched                          |
| `headers`                               | the request's `Headers` (`context.headers.get('authorization')`) |
| `cookies`                               | parsed request cookies as a readonly record                      |
| `ipAddress`, `userAgent`                | caller details                                                   |
| `isRpc`, `rpc` / `isGraphQL`, `graphql` | which dispatcher is running, with dispatch-specific info         |
| `isInternal`, `routing`                 | whether the call came from a bound worker, and from whom         |
| `handler`                               | the resolved handler once routing completes                      |
| `container`                             | the request's DI container                                       |
| `response`                              | write response headers/cookies from anywhere (below)             |
| `deferred`                              | schedule post-response work (below)                              |
| `eventBus`                              | the per-request event bus                                        |

## Write to the response from anywhere

Handlers return their own `Response`, but middleware and services don't have one to return. `context.response` is the escape hatch. Headers and cookies set through it are applied to whatever response the handler produces:

```ts
context.response.appendHeader('x-request-id', context.requestId);
context.response.setCookie({ name: 'theme', value: 'dark' });
```

## Defer work past the response

`context.deferred.append(...)` schedules async work that runs **after** the response is sent, and the platform keeps the worker alive for it:

```ts
@HttpRoute('POST', '/orders')
async create(@InjectRequestContext() context: RequestContext): Promise<OrderJson> {
    const order = await this.placeOrder();
    context.deferred.append(async () => {
        await this.analytics.record('order-placed', order.id);
    });
    return order; // responds immediately; analytics runs afterward
}
```

This is the right home for analytics, cache warming, notifications: anything the caller shouldn't wait on.

## Typed request state

Application state rides on the context through typed keys, never ad-hoc properties:

```ts
import { RequestContextKey } from '@system-inc/base-foundation/request/RequestContextKey';

export const tenantKey = new RequestContextKey<string>('tenant');

// middleware writes…
context.set(tenantKey, resolveTenant(context));

// …handlers read, either explicitly:
const tenant = context.get(tenantKey);

// or injected directly by key:
handler(@InjectRequestContext(tenantKey) tenant: string | undefined) { ... }
```

The key's generic types both ends, and `get` honestly returns `T | undefined`, so nothing pretends a middleware ran if it didn't. See [Middleware](../http/05-middleware.md) for the full write-then-read pattern.
