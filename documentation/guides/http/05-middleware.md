---
title: Middleware
description: Run code before handlers (globally or per route) and pass typed values through the RequestContext.
---

Middleware is a function that receives the `RequestContext` before a handler runs. It comes in two flavors: **global middleware** runs for every request before routing; **handler middleware** is attached to specific routes with `@WithMiddleware` and runs after the route is matched, just before the handler.

## Write a middleware

A middleware shapes the request context. To pass data along, define a typed context key and set it:

```ts
import { RequestContext } from '@system-inc/base-foundation/request/RequestContext';
import { RequestContextKey } from '@system-inc/base-foundation/request/RequestContextKey';

export const requestSourceKey = new RequestContextKey<string>('requestSource');

export const requestSourceMiddleware = (requestContext: RequestContext) => {
    requestContext.set(
        requestSourceKey,
        requestContext.userAgent?.includes('Mobile') ? 'mobile' : 'desktop',
    );
};
```

`RequestContextKey<T>` makes the value typed at both ends — no string-keyed grab bag.

## Attach it to a route

```ts
import { WithMiddleware } from '@system-inc/base-foundation/middleware/decorators/WithMiddleware';
import { InjectRequestContext } from '@system-inc/base-foundation/request/decorators/RequestContextDecorator';

    @WithMiddleware(requestSourceMiddleware)
    @HttpRoute('GET', '/landing')
    landing(@InjectRequestContext() context: RequestContext): Response {
        return new Response(context.get(requestSourceKey));
    }
```

Even tighter: inject just the value by passing the key to `@InjectRequestContext`:

```ts
@WithMiddleware(requestSourceMiddleware)
@HttpRoute('GET', '/landing')
landing(
    @InjectRequestContext(requestSourceKey) source: string | undefined,
): Response {
    return new Response(source ?? 'unknown');
}
```

## Register it globally

Global middleware goes in `settings.ts` and runs for every request — HTTP and GraphQL alike, since both dispatchers share the request pipeline:

```ts
    middleware: {
        global: [requestSourceMiddleware],
    },
```

Use global middleware for cross-cutting concerns (request tagging, telemetry, tenant resolution) and `@WithMiddleware` for anything only some routes need.
