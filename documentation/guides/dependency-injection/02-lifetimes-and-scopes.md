---
title: Lifetimes and Scopes
description: How long an instance lives, and why each platform event gets its own container.
---

Base runs a small hierarchy of DI containers, and every injectable class picks a lifetime with its decorator. Most of the time `@Injectable()` is right; this guide is for when it isn't.

## The scope tree

```
@global ──► @worker ──► { @request | @queue | @scheduled | @websocket }
```

- **`@global`**: process-wide; stateless registrations (providers, configuration).
- **`@worker`**: one per worker instance; lives as long as the runtime does.
- **The event scopes** — a fresh child container per platform event: each HTTP request, queue batch, cron tick, or WebSocket event gets its own, and it's disposed when the event completes.

Handlers resolve from the event container. That's why request state never leaks between requests: the container your service came from didn't exist a moment ago and won't exist a moment later.

## The lifetime decorators

| Decorator             | One instance per…      | Use for                                                                                      |
| --------------------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| `@Injectable()`       | resolution (transient) | the default — cheap, stateless services                                                      |
| `@ContainerScoped()`  | container              | per-event caching: everyone in one request shares an instance; next request gets a fresh one |
| `@WorkerScoped()`     | worker                 | connection pools, caches, per-worker state                                                   |
| `@ResolutionScoped()` | resolution chain       | one shared instance across a single resolve graph                                            |
| `@Singleton()`        | process (global)       | rarely — see below                                                                           |

Two worth understanding well:

**`@ContainerScoped()`** is "request-scoped" in practice: within one event, every injection of the class shares an instance; across events, instances are never shared. The right home for per-request caching or accumulation.

**`@WorkerScoped()` is the singleton you usually want.** A true `@Singleton` registers on the _global_ container — which is shared state across everything in the process, a real hazard when the same process hosts multiple workers or Durable Objects. `@WorkerScoped()` gives you one instance per worker, resolvable from any event scope, without cross-worker leakage.

## Choosing

- Default to `@Injectable()`. If construction is cheap and the class is stateless, transient costs nothing.
- Reach for `@ContainerScoped()` when you want "same instance within this request."
- Reach for `@WorkerScoped()` when you want "same instance for the life of this worker."
- Treat `@Singleton()` as a deliberate exception with a reason attached.

One consequence of the design worth internalizing: because handlers resolve from per-event containers, **instance fields on transient and container-scoped services are safe** — they can't outlive the event. State that must survive the event belongs in a `@WorkerScoped()` service, a [database](../orm/01-define-an-entity.md), or platform storage.
