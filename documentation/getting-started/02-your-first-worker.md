---
title: Your First Worker
description: Understand the three files that make a Base worker, then build a typed, validated JSON API.
---

By the end of this tutorial you'll understand every moving part of the worker you scaffolded, and you'll have built your own service: a small notes API with typed, validated JSON input.

You'll need the `my-app` workspace from [Installation](./01-installation.md), with the dev server running (`npx base develop -w app`).

## The three files that matter

### `index.ts`: The entry point

```ts
import '@system-inc/base-foundation/startup/preload';

import { BaseWorker } from '@system-inc/base-foundation/worker/BaseWorker';
import { Settings } from './settings';

export default BaseWorker.create(Settings);
```

That's the whole file, and it rarely changes. `BaseWorker.create(Settings)` exports the standard Cloudflare Worker shape (`fetch` / `queue` / `scheduled`). The `startup/preload` import must come first; it loads the runtime support decorators depend on.

Notice the import paths: Base has no barrel files. Every import is a per-file subpath like `@system-inc/base-foundation/worker/BaseWorker`. Your editor's auto-import handles this, and it keeps bundles lean and dependencies explicit.

### `settings.ts`: What your worker is

```ts
import { BaseSettings } from '@system-inc/base-foundation/base/BaseSettings';
import { HelloWorldService } from './source/services/HelloWorldService';

export const Settings: BaseSettings = {
    name: 'app',
    version: '1.0.0',
    title: 'app',
    server: {
        '@default': {
            port: 3000,
            host: 'localhost',
        },
    },
    modules: [],
    // Self-describing classes: each class's decorator (@HttpService,
    // @GqlResolver, @RpcService, …) declares its dispatch surface.
    services: [HelloWorldService],
};
```

Two things to internalize:

- **`services` is one flat list for every kind of class.** There is no separate list of routes, resolvers, or processors. Each class's decorator declares its role (`@HttpService` means HTTP routes, `@GqlResolver` means GraphQL) and Base sorts them at boot. A listed class with no recognized decorator is a boot error: registration is explicit, never magic.
- **`'@default'` is an environment key.** Settings like `server` are maps keyed by environment name (`Development`, `Production`, …) with `'@default'` as the fallback. One settings file describes every environment.

### The service: Where your code lives

`source/services/HelloWorldService.ts`:

```ts
import { Inject } from '@system-inc/base-foundation/dependency-injection/decorators/Inject';
import { Injectable } from '@system-inc/base-foundation/dependency-injection/decorators/Injectable';
import { HttpPath } from '@system-inc/base-foundation/router/decorators/HttpPath';
import { HttpRoute } from '@system-inc/base-foundation/router/decorators/HttpRoute';
import { HttpService } from '@system-inc/base-foundation/router/decorators/HttpService';
import { GreetingService } from './GreetingService';

@Injectable()
@HttpService()
export class HelloWorldService {
    constructor(
        @Inject(GreetingService)
        private readonly greetingService: GreetingService,
    ) {}

    @HttpRoute('GET', '/')
    helloWorld(): Response {
        return new Response(this.greetingService.greet());
    }

    @HttpRoute('GET', '/:name')
    helloName(@HttpPath('name') name: string): Response {
        return new Response(this.greetingService.greet(name));
    }
}
```

- `@HttpService()` marks the class as an HTTP dispatch surface; `@HttpRoute(method, path)` binds each method to a route.
- `@HttpPath('name')` pulls the `:name` segment out of the URL and hands it to you as an argument. No request parsing in your handler.
- `@Injectable()` + `@Inject(GreetingService)` is dependency injection: `GreetingService` is resolved from the container and handed to the constructor.

And the service being injected (`source/services/GreetingService.ts`) is just a plain class:

```ts
import { Injectable } from '@system-inc/base-foundation/dependency-injection/decorators/Injectable';

/**
 * A plain injectable service. Holding the worker's real logic in a service
 * like this (rather than inline in the HTTP route) makes it (1) reusable by
 * any handler that injects it and (2) unit-testable in isolation. See
 * GreetingService.test.ts.
 */
@Injectable()
export class GreetingService {
    greet(name?: string): string {
        const trimmed = name?.trim();
        return `Hello, ${trimmed || 'world'}!`;
    }
}
```

No HTTP anywhere in it. Keeping the real logic in plain services makes it reusable by any handler that injects it, and unit-testable in isolation; the scaffold ships `GreetingService.test.ts` to prove the point.

Each incoming request gets a fresh request-scoped container, your service is resolved from it, the route method runs, and the response goes back. That's the whole lifecycle from your code's point of view.

## Build a notes API

Time to write your own service. You'll build `POST /notes`, `GET /notes`, and `GET /notes/:id`, with a typed, validated request body.

Create `workers/app/source/services/NoteService.ts`:

```ts
import { HttpErrors } from '@system-inc/base-foundation/error/HttpErrors';
import { HttpBody } from '@system-inc/base-foundation/router/decorators/HttpBody';
import { HttpPath } from '@system-inc/base-foundation/router/decorators/HttpPath';
import { HttpRoute } from '@system-inc/base-foundation/router/decorators/HttpRoute';
import { HttpService } from '@system-inc/base-foundation/router/decorators/HttpService';
import { SerializableField } from '@system-inc/base-foundation/serialization/decorators/SerializableField';
import { SerializableObject } from '@system-inc/base-foundation/serialization/decorators/SerializableObject';
import { VerifyIsNotEmpty } from '@system-inc/base-foundation/validation/decorators/VerifyIsNotEmpty';

@SerializableObject()
export class CreateNoteInput {
    @VerifyIsNotEmpty()
    @SerializableField(() => String)
    title: string;

    @SerializableField(() => String)
    content: string;
}

interface Note {
    id: number;
    title: string;
    content: string;
}

// In-memory for now and replaced with a real database in the next tutorial.
// This wouldn't work in a real worker.
const notes: Note[] = [];

@HttpService()
export class NoteService {
    @HttpRoute('POST', '/notes')
    create(@HttpBody(() => CreateNoteInput) input: CreateNoteInput): Note {
        const note: Note = {
            id: notes.length + 1,
            title: input.title,
            content: input.content,
        };
        notes.push(note);
        return note;
    }

    @HttpRoute('GET', '/notes')
    list(): { notes: Note[] } {
        return { notes };
    }

    @HttpRoute('GET', '/notes/:id')
    get(@HttpPath('id', () => Number) id: number): Note {
        const note = notes.find((candidate) => candidate.id === id);
        if (!note) {
            throw HttpErrors.notFound({ message: 'Note not found.' });
        }
        return note;
    }
}
```

What's new here:

- **`@HttpBody(() => CreateNoteInput)`** deserializes the JSON body into a real `CreateNoteInput` instance and validates it before your handler runs. The `@SerializableObject()` / `@SerializableField` decorators define the shape; `@VerifyIsNotEmpty()` adds a validation rule. Invalid input never reaches your code.
- **Handlers can return plain objects.** Return a `Response` when you need full control; return an object and Base wraps it in `Response.json(...)` for you.
- **`@HttpPath('id', () => Number)`** coerces the path segment to a number before you see it.
- **Thrown `HttpErrors` become proper HTTP responses**: `HttpErrors.notFound(...)` is a 404 with a structured error body.

## Register it

Every class must be listed to exist. Add `NoteService` to `settings.ts`:

```ts
import { NoteService } from './source/services/NoteService';
```

```ts
    services: [NoteService, HelloWorldService],
```

Order matters here: routes bind in registration order, and `HelloWorldService`'s
parameterized `GET /:name` matches `/notes` too. Listing `NoteService` first
means its routes are tried first; otherwise `GET /notes` would answer
`Hello, notes!`.

## Try it

The dev server reloads on save. Create a note:

```bash
curl -X POST http://localhost:3000/notes \
    -H 'Content-Type: application/json' \
    -d '{"title": "First note", "content": "Written with Base."}'
```

```json
{ "id": 1, "title": "First note", "content": "Written with Base." }
```

List and fetch:

```bash
curl http://localhost:3000/notes
curl http://localhost:3000/notes/1
```

Now try to break it by sending an empty title:

```bash
curl -X POST http://localhost:3000/notes \
    -H 'Content-Type: application/json' \
    -d '{"title": "", "content": "no title"}'
```

Validation rejects it before your handler runs. That's the validation pipeline you'll meet again, unchanged, in GraphQL and RPC.

## One problem

Restart the dev server and fetch `/notes` again: empty. Workers are stateless: in-memory data lives only as long as the runtime instance. Real data needs a real database.

Next: [Add a Database](./03-add-a-database.md), where you define an entity, run migrations, and persist your notes in Cloudflare D1.
