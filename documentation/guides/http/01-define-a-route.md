---
title: Define a Route
description: Bind methods to HTTP routes with @HttpService and @HttpRoute, and control the response.
---

Routes live on service classes: `@HttpService()` marks the class as an HTTP surface, `@HttpRoute(method, path)` binds each method. REST endpoints are the right tool for public and third-party-facing APIs; for your own frontend or worker-to-worker calls, prefer [RPC](../rpc/01-use-rpc.md).

## A basic route

```ts
import { HttpRoute } from '@system-inc/base-foundation/router/decorators/HttpRoute';
import { HttpService } from '@system-inc/base-foundation/router/decorators/HttpService';

@HttpService()
export class StatusService {
    @HttpRoute('GET', '/status')
    status(): Response {
        return Response.json({ ok: true });
    }
}
```

Register the class in your worker's `services` array in `settings.ts` — a class that isn't listed doesn't exist:

```ts
    services: [StatusService],
```

Handlers can be `async` and routes can use `:param` segments (see [Read Request Parameters](./02-read-request-parameters.md)).

## Multiple methods, any method

`@HttpRoute` takes a single method, an array, or `'ALL'`:

```ts
@HttpRoute(['GET', 'POST'], '/webhooks/github')
webhook(): Response { ... }

@HttpRoute('ALL', '/proxy')
proxy(): Response { ... }
```

## Route matching order

Routes bind in registration order and the first match wins: within a service,
methods top to bottom; across services, in `services`-array order. A
parameterized segment matches anything, so `GET /:name` also matches `/notes`
— if both exist, the service with the static route must be registered first:

```ts
// NoteService's GET /notes must bind before GreetingService's GET /:name.
services: [NoteService, GreetingService],
```

## Response handling

You control how much ceremony a response gets:

- **Return a `Response`** for full control: status, headers, streaming.
- **Return a plain object (or array)** and Base wraps it in `Response.json(...)`.
- **Return a string** and it becomes a plain-text response body.
- **Return nothing** and Base sends an empty `200 OK`.

```ts
@HttpRoute('GET', '/notes')
async list(): Promise<{ notes: NoteEntity[] }> {
    return { notes: await this.notes.find() };
}
```

## Errors

Throw an `HttpErrors` factory error anywhere in a handler and Base converts it to the matching HTTP response with a structured error body:

```ts
import { HttpErrors } from '@system-inc/base-foundation/error/HttpErrors';

    @HttpRoute('GET', '/admin')
    admin(): Response {
        throw HttpErrors.forbidden({ message: 'Administrators only.' });
    }
```

The factories cover the standard range: `badRequest`, `unauthorized`, `forbidden`, `notFound`, `methodNotAllowed`, `conflict`, `unprocessableEntity`, `internalServerError`, `serviceUnavailable`, and more. To return an error response without throwing, wrap it: `HttpResponses.fromError(HttpErrors.forbidden({ ... }))` (from `@system-inc/base-foundation/http/HttpResponses`).
