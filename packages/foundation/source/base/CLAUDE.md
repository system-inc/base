# base/ — app runtime & bootstrap

The entry point and engine of a worker. `BaseWorker` is the object your worker module exports; `Base` is the engine it drives — it initializes the app, owns the routers/dispatchers, and turns each platform event (request / queue / scheduled / websocket) into work on a freshly-scoped DI container. This doc also covers the `worker/` folder, which is part of the same bootstrap story.

## Files

| File                                   | Role                                                                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base/Base.ts`                         | The engine. Lifecycle (`initialize`) + the event handlers (`handleRequest`, `handleMessages`, `handleScheduled`, `webSocket*`).                         |
| `base/BaseSettings.ts`                 | The interface you implement to configure a worker (see the [package doc](../../CLAUDE.md) for the field list). `isBaseSettings()` is the runtime guard. |
| `base/BaseServerSettings.ts`           | Local dev-server settings (`BaseSettings.server`).                                                                                                      |
| `base/BaseMetadata.ts`                 | Process-global metadata registries (see below).                                                                                                         |
| `worker/BaseWorker.ts`                 | The exported worker object: `fetch`/`queue`/`scheduled` handlers.                                                                                       |
| `worker/BaseWorkerContext.ts`          | Bundles `BaseConfiguration` + the `@worker` DI container.                                                                                               |
| `worker/BaseWorkerDelegate.ts`         | Optional app hooks: `onInitialize(base)`, `onStart`, `onStop`.                                                                                          |
| `worker/BaseWorkerPlatformDelegate.ts` | The 3-method platform interface (see [package doc](../../CLAUDE.md#key-design-choices)).                                                                |

## Bootstrap flow

```
your worker entry ──► BaseWorker.create(settings)
                          │  exposes fetch / queue / scheduled (Cloudflare Worker export shape)
                          ▼
   first event ──► BaseWorker.getBase(env)
                          │  lazily creates the @worker container (createWorkerContainer)
                          │  registers BaseWorkerContext + BaseConfiguration as instances
                          ▼
                       new Base(context)
                          │
   each handler ──► Base.initialize()  (idempotent)  ──► dispatch event
```

`BaseWorker` has a **private constructor** (no subclassing) and is created via `BaseWorker.create(settings)`. It lazily builds the `@worker` container and a single `Base` instance (`getBase(env)`), registering `BaseWorkerContext` and `BaseConfiguration` into the container as instances. Its `fetch`/`queue`/`scheduled` arrow properties are the Cloudflare Worker handler shape; each wraps the platform args in a `BaseExecutionContext` (start time + `StopWatch` + `waitUntil`) and calls the matching `Base` handler.

`BaseWorkerContext` just constructs `new BaseConfiguration(environmentVariables, settings)` and holds it alongside the worker container (plus custom `toJSON`/`toString`/Node-inspect for readable logging).

## `Base.initialize()`

Idempotent (guarded by `isInitialized`). In order it:

0. `initializeLogging()` — applies `configuration.logging` to the process-global `Logger`: the settings-level default and per-category `categories` first, then the `LOG_LEVEL` env directive so a deploy-time override (including per-category entries like `warn,rpc=debug`) always wins where it speaks; also caches the `requestLog` switch read on every request. Runs first so even the boot logs respect the threshold.
1. `initializeGql()` — if `graphql` is configured, registers the GraphQL route (POST, + GET when `graphiql` is on) that defers to the lazy `GqlDispatcher`.
2. `initializeWebSocketRoutes()` — a GET route per configured `webSocket.delegates[].path`, handled by the lazy `WebSocketService`.
3. `initializeRpcRoute()` — if `rpcServer` is configured, a POST route at `rpcServer.route ?? DefaultRpcEndpoint` deferring to the lazy `RpcDispatcher`.
4. `initializeModules()` — `await module.onInitialize(configuration)` for each module.
5. `platformDelegate.initializePlatform(configuration)`.
6. `delegate?.onInitialize(this)` — the app's `BaseWorkerDelegate` hook.
7. `router.bindRoutes()` — finalize routes.

The **platform delegate** is selected from `configuration.runtime.platform.type`: `CloudflareWorker`/`CloudflareDurableObject` → `CloudflarePlatformDelegate`, `Node` → `NodePlatformDelegate`. The **router** is `IttyRouter()` normally, but a `DummyRouter()` under the CLI (`runtime.mode.isCommandLine`) so CLI inspection doesn't crash on Itty.

## Event handling (the per-event pattern)

All four handlers share a shape: `await initialize()`, create a child container for the scope, do the work, and **always `runDeferredActions`** in `finally`.

| Handler                                            | Scope container | Work                                                                                                                                                    |
| -------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `handleRequest(request, execCtx, wsInfo?)`         | `@request`      | optional URL `rewrite`, build a `BaseRequest`, `router.handleRequest`; request line (info, gated by `logging.requestLog`) + stopwatch breakdown (debug) |
| `handleMessages(messages, execCtx)`                | `@queue`        | `WorkerQueueConsumer.processMessages` over `queue.processors`                                                                                           |
| `handleScheduled(event, execCtx)`                  | `@scheduled`    | `ScheduledRunner.runScheduled` over `scheduled.executables` (with `concurrency`)                                                                        |
| `webSocketMessage/Close/Error/Register/Unregister` | `@websocket`    | delegate to `WebSocketService` (Register/Unregister are Node-only)                                                                                      |

**`BaseRequest`** (built in `createBaseRequest`) is the platform `Request` augmented in place with `{ route, params, query, cookies, context }` and a `BASE_REQUEST_BRAND`. A `satisfies Omit<BaseRequest, keyof Request>` makes adding a field to `BaseRequest` a compile error until it's populated here. `cookies`/`query` are filled later by the router's global middleware.

**Deferred actions / disposal** (`runDeferredActions`, child scopes only): resolves the per-container `DeferredExecutor`, appends a worker-queue drain (`WorkerQueueService.drain()`), then runs everything inside `executionContext.waitUntil(...)` and disposes the container afterward. This is how post-response work (queue publishing, cleanup) runs after the response is returned, and how request-scoped state is torn down.

## `BaseMetadata` — process-global registries

`getBaseMetadata()` returns a single `BaseMetadata` stashed on the global object. It holds the framework's own cross-cutting metadata registries that decorators write into and the runtime reads: `graphql`, `scheduled`, `queue`, `middleware`, `eventBus`, `validation`. This is distinct from the `DecoratorRegistry` in `common` (which only _marks_ which decorator a class carries for boot-time validation) — `BaseMetadata` holds the actual per-feature metadata the dispatchers consume.

**Module metadata is not registered here.** A module's bespoke metadata (e.g. what its decorators collect) is import-time singleton state the module owns itself — a module-scope singleton in the module's own file, the same pattern as `DecoratorRegistry`'s static instance. The framework's invariant is **one copy of the code per process** (`DecoratorRegistry` already depends on it), so a central registry adds no safety — and a `globalThis`-stashed one would outlive jest's per-file module registry and dev-server reloads that reset decorator state, letting metadata go stale against fresh marks.

## See also

[`module/`](../module/CLAUDE.md) (composition) · [`dependency-injection/`](../dependency-injection/CLAUDE.md) (scopes & containers) · [`configuration/`](../configuration/CLAUDE.md) (`BaseConfiguration`, runtime/platform).
