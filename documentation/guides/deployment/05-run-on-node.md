---
title: Run on Node
description: Run a Base worker as a plain Node process, with the same app model on a different platform.
---

Base's app model (settings, modules, services, decorators, DI) is platform-neutral. A **platform delegate** adapts it to what's underneath: Cloudflare's workerd by default, or Node. This isn't a novelty; it's how Base's own test suite runs, and how [containers](../storage/04-containers.md) execute your worker inside Docker.

## Run it

```bash
npx base develop app --platform node
```

Instead of `wrangler dev`, the CLI spawns a Node process running a launcher that loads your `settings.ts` and starts an HTTP server on your configured port. Same routes, same services:

```bash
curl http://localhost:3000/
# Hello, world!
```

Your `@HttpService` classes, GraphQL resolvers, RPC procedures, validation, DI, middleware: all identical. Nothing in your service code knows which platform it's on.

## What changes: the bindings

What does _not_ come along are Cloudflare's platform resources. On Node there is no D1, KV, R2, Durable Object, or Queue binding, since those are workerd concepts. Concretely: a D1-backed database has no Node equivalent, so a worker that must run on both platforms picks its database per environment.

The ORM has first-class answers: the `better-sqlite` driver (a local SQLite file, the natural Node counterpart to D1) and the `planetscale` driver (hosted MySQL, works from anywhere). Both are ordinary [named database configurations](../orm/07-multiple-databases.md); your entities and repositories don't change.

The rule of thumb: **code above the bindings is portable; the bindings themselves are per-platform configuration.** Settings were designed to hold exactly that difference; see [Environments and Configuration](./01-environments-and-configuration.md).

## When you'll use it

- **Tests**: integration tests target a live worker over HTTP; unit tests and the framework's own suite run everything on Node with zero Cloudflare in the loop.
- **Containers**: the [container story](../storage/04-containers.md) is this pattern in production, with your worker bundled alongside a Node bootstrap, running `node ./bootstrap.js ...` inside Docker. If your worker runs on Node, it runs in a container.
- **Debugging**: the scaffold's **"Run: Current Worker (Node)"** VS Code configuration launches the worker under the debugger as a plain Node process ([Debugging](../debugging/01-debugging.md)), often the fastest way to step through boot-time behavior.

`BaseWorker.create(settings)` describes an application, not a Cloudflare Worker; the platform delegate decides what that description runs on. Write services against Base's abstractions (repositories, stores, queues, context) rather than raw platform APIs, and portability is the default.
