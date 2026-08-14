# @system-inc/base-foundation

The core framework. Everything you declare in a Base worker — services, resolvers, entities, queue processors, scheduled tasks, RPC services — is wired and dispatched by this package. It's by far the largest (~500 source files across ~27 subsystems). Depends on `base-client` and `base-common`; almost everything else (Cloudflare, GraphQL, ORM libraries) is a **peer dependency**.

> Folder-level `CLAUDE.md` files live inside the major subsystems below and go deeper than this overview. Start here, then open the subsystem you're working in.

## Purpose

Turn a declarative, decorator-driven app definition into a running Cloudflare Worker. You compose your app from **modules**; the framework builds a **dependency-injection container**, wires the decorated classes you register, and dispatches platform events (HTTP request, queue message, cron trigger, WebSocket event, RPC call) to the right handler with the right scoped dependencies. A platform-delegate abstraction lets the same app target either Cloudflare or **Node** — Node is a first-class deployment target (you can build a complete Node-based worker, and it's also what tests run on), the trade-off being that Cloudflare bindings (Durable Objects, Queues, KV, R2) aren't available there.

## How it's consumed

Per-file subpath imports — **no barrel**:

```ts
import { Base } from '@system-inc/base-foundation/base/Base';
import { BaseModule } from '@system-inc/base-foundation/module/BaseModule';
```

The app is described by a `BaseSettings` (`base/BaseSettings.ts`) — required `name`/`title`/`version`, the list of `modules`, and optional per-subsystem settings (`orm`, `graphql`, `router`, `rpc`, `queue`, `scheduled`, `webSocket`, `keyValueStorage`, `objectStore`, `durableObjects`, `middleware`, `accessControl`, `eventBus`, `logging`, `providers`, …) — and run by the `Base` class (`base/Base.ts`), whose lifecycle methods (`initialize`, `handleRequest`, `handleMessages`, `handleScheduled`, and the `webSocketMessage`/`Close`/`Error`/`Register`/`Unregister` handlers) are invoked by the worker entry / platform delegate.

## Key design choices

### Public folder + `internal/` split

The defining convention. A subsystem's **public** folder holds the types/decorators/settings you use (`queue/`, `router/`, `graphql/`, `rpc/`, `web-socket/`, `key-value-storage/`, `object-store/`…); its runtime machinery lives under **`internal/`** (`internal/queue/`, `internal/router/`, `internal/graphql/`, `internal/request/`, `internal/dependency-injection/`, the platform delegates). Consumer code — and code outside the subsystem — never imports from `internal/`; the `nexus/no-internal-imports-rule` lint rule (from `@system-inc/nexus`, enabled via `base-lint`) guards the line.

### Decorators + a decorator registry

Routes, resolvers, entities, queue processors, scheduled executables, RPC services, and injections are declared with decorators (built on `reflect-metadata`). You still **register** the classes explicitly in module/worker settings (see below) — registration is not automatic, but it is _role-free_: every class goes in the single `services` array, and the decorators say what it is. Decorators call `DecoratorRegistry.get().mark(ctor, <decoratorName>)` (registry from `common`); at boot `configuration/BaseAppManifest.ts` reads those marks to sort each `services` class into its dispatch surface(s), and rejects a listed class with no recognized decorator. The `base-lint` rules read the same decorator metadata to enforce type/decorator parity.

### Dependency injection (tsyringe)

A scoped container hierarchy with six scopes (`BaseInjectionContainer.scope`): `@global → @worker → {@request | @queue | @scheduled | @websocket}`. `createWorkerContainer()` makes the `@worker` container a child of `@global`; the `Base` engine spins up a fresh child off `@worker` per event (`createWorkerChildContainer`). Child containers inherit the parent's registrations, and `Base.createChildContainer` registers a per-event, instance-cached `DeferredExecutor` and `BaseEventBus` into each one so a request/queue/scheduled/websocket gets isolated, independently-disposable instances. User classes opt into a lifecycle with a decorator — `@Singleton` (`@global`), `@WorkerScoped()` (`@worker`), `@ContainerScoped()` / `@ResolutionScoped()` (tsyringe lifecycles). `dependency-injection/` holds the public surface: `BaseInjectionContainer`, the inject decorators (`decorators/`, one per file), and typed tokens (`TypedInjectionKey`, `TypedBinding`, `TypedParameterDecorator`, `TypedMethodDecorator`) that carry type info so the lint rules can check inject/provider types.

### Module system

`BaseModule` (`module/BaseModule.ts`) is the composable unit, built via `BaseModule.create({ key, settings, uses?, onCreate?, onInitialize? })` — `key` is the module's `BaseModuleKey`, the same object consumers use with `uses`, `getModuleSettings(key)`, and declared membership (`@Injectable(key)`); its phantom settings type is enforced against the module's settings. `settings` (`ModuleSettings`) is where a module registers its parts: `services` (the single class slot — resolvers, HTTP/RPC services, queue processors, scheduled executables, event listeners, provider hosts, DI helpers, each sorted by its decorator), `orm` entities, `webSocket` delegates, `middleware`, and GraphQL `directives`. `uses` declares dependencies on other modules (used to order middleware and initialization); `onCreate`/`onInitialize` are lifecycle hooks (`onInitialize` receives the `BaseConfiguration`). Per-feature opt-outs are available through `BaseModule.create`'s `options` (e.g. `{ orm: false }`). (`WorkerConfigValidator`, despite living here, is a CLI `check`-command extension point via `BaseSettings.cli.configValidators`, not a boot-time validator.)

### Platform abstraction

`BaseWorkerPlatformDelegate` (`worker/BaseWorkerPlatformDelegate.ts`) is a small interface — three methods — that isolates a handful of platform-specific request details, not a broad runtime bridge:

- `initializePlatform(configuration)` — one-time platform init (the Cloudflare impl patches `fetch` to strip cache options Workers don't support; the Node impl is a no-op).
- `getRequestIpAddress(request)` — Cloudflare reads the CF IP header; Node returns `undefined`.
- `getPlatformRequestProperties(request)` — Cloudflare returns `request.cf`; Node returns `{}`.

It's implemented by `internal/cloudflare/CloudflarePlatformDelegate` and `internal/node/NodePlatformDelegate` — Node being a first-class target for building complete workers (minus Cloudflare bindings), not just a test shim. Cloudflare _primitives_ (Durable Objects, Queues, KV, R2) are **not** routed through this delegate — each has its own subsystem and factory (`cloudflare/`, `queue/` + `internal/queue/`, `key-value-storage/`, `object-store/`).

### ORM — Drizzle (`orm/`)

`orm/` (~150 files) is the framework's sole ORM, with its own database/adapter/repository/schema/migration layers over `drizzle-orm`. You define entities with `@Orm*` decorators, register them in a module's `orm.entities`, and inject repositories. The only ORM adapter family is Drizzle (`OrmAdapterType` is the literal `'drizzle'`); a backend is identified as a (dialect, driver) pair (`OrmDatabaseType`): **SQLite** via Cloudflare D1, Durable Object SQLite, or `better-sqlite3` (Node), and **MySQL** via PlanetScale. The CLI's `orm` commands drive schema/migration ops.

### GraphQL via type-graphql + graphql-yoga

Resolvers are decorated classes registered through module/worker settings. The GraphQL server — a graphql-yoga provider (`graphql/providers/GraphQLYoga.ts`) — is created lazily on first use by `internal/graphql/GqlDispatcher`, which exposes the built `schema`. `graphql/` holds the public decorators/types; `internal/graphql/` holds the dispatcher, context, and middleware.

### Validation + serialization

`validation/` is a decorator-driven rule engine: `ValidationEngine` runs property decorators from `validation/decorators/` (`@VerifyIsEmail`, `@VerifyMin`, `@VerifyLength`, `@VerifyIsOptional`, …, plus `@VerifyBy` and `@RegisterRule` for custom rules), throwing `ValidationError` on failure. `serialization/` is also decorator-driven (`@SerializableObject`, `@SerializableField`; metadata in `serialization/internal/`) and provides `Serialize`/`Deserialize`.

## Subsystem map (`source/`)

**Public subsystems** (each a candidate for its own folder-level `CLAUDE.md`):

| Folder                                                             | What it does                                                                                                                                                                                                       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`base/`](./source/base/CLAUDE.md)                                 | `Base` runtime + `BaseSettings`/`BaseServerSettings`/`BaseMetadata` — the app definition and lifecycle (also covers `worker/`)                                                                                     |
| [`module/`](./source/module/CLAUDE.md)                             | `BaseModule`, `ModuleSettings`; `WorkerConfigValidator` (a CLI `check`-command extension point)                                                                                                                    |
| [`dependency-injection/`](./source/dependency-injection/CLAUDE.md) | Container, inject decorators, typed tokens/bindings                                                                                                                                                                |
| `worker/`                                                          | `BaseWorker`, `BaseWorkerContext`, `BaseWorkerDelegate`, platform-delegate base                                                                                                                                    |
| [`configuration/`](./source/configuration/CLAUDE.md)               | `BaseConfiguration`, runtime/env/platform, typed env keys, `BaseAppManifest`                                                                                                                                       |
| [`router/`](./source/router/CLAUDE.md)                             | **HTTP request handling** — one doc covering `router/` + `request/` + `http/` + `middleware/`: routing decorators, `RequestContext`, middleware, dispatch                                                          |
| [`request/`](./source/router/CLAUDE.md)                            | Request context (`RequestContext`, `RequestOrigin`, `DeferredActions`, `ResponseWriter`, `@InjectRequestContext`) — see the [HTTP doc](./source/router/CLAUDE.md)                                                  |
| [`http/`](./source/router/CLAUDE.md)                               | HTTP response/header helpers — see the [HTTP doc](./source/router/CLAUDE.md)                                                                                                                                       |
| [`orm/`](./source/orm/CLAUDE.md)                                   | Drizzle ORM: adapters, repositories, schema, migrations, filters _(the framework's ORM; ~150 files)_                                                                                                               |
| [`graphql/`](./source/graphql/CLAUDE.md)                           | GraphQL decorators, schema providers (yoga), dispatcher, settings                                                                                                                                                  |
| [`queue/`](./source/queue/CLAUDE.md)                               | Queue produce (`@InjectWorkerQueue`) + consume (`@WorkerQueueProcessor`); batched drain                                                                                                                            |
| [`scheduled/`](./source/scheduled/CLAUDE.md)                       | Scheduled executables (`@ScheduledExecutable`), cron + Durable Object alarms                                                                                                                                       |
| [`rpc/`](./source/rpc/CLAUDE.md)                                   | RPC service decorators + dispatch, client bindings/factory/drivers, visibility                                                                                                                                     |
| [`web-socket/`](./source/web-socket/CLAUDE.md)                     | WebSocket delegates, `WebSocketInfo`, Cloudflare (Durable Object) / Node implementations                                                                                                                           |
| [`event/`](./source/event/CLAUDE.md)                               | In-process event bus + `@EventBusListener` (publish / defer)                                                                                                                                                       |
| `logging/`                                                         | `LoggingSettings` (`BaseSettings.logging`: default level + per-category `categories` + `requestLog` switch) — the `Logger` itself lives in `common/logging/`; `Base` applies levels at boot, `LOG_LEVEL` overrides |
| [`validation/`](./source/validation/CLAUDE.md)                     | Validation rule engine + errors _(~70 files)_                                                                                                                                                                      |
| [`serialization/`](./source/serialization/CLAUDE.md)               | Decorator-driven serialize/deserialize (`@SerializableObject`/`@SerializableField`)                                                                                                                                |
| [`error/`](./source/error/CLAUDE.md)                               | `BaseError`, `HttpErrors`, `ArgumentValidationError`, client masking, DB transformers                                                                                                                              |
| [`key-value-storage/`](./source/key-value-storage/CLAUDE.md)       | KV store: `KeyValueStorage`, binding + `@InjectKeyValueStorage`                                                                                                                                                    |
| [`object-store/`](./source/object-store/CLAUDE.md)                 | R2/S3 object storage: `ObjectStore`, binding + `@InjectObjectStore`                                                                                                                                                |
| [`cloudflare/`](./source/cloudflare/CLAUDE.md)                     | Durable Objects & Containers — authoring + binding/provider/inject to call them                                                                                                                                    |
| [`cryptography/`](./source/cryptography/CLAUDE.md)                 | Encrypted-token + key services (AES, rotation)                                                                                                                                                                     |
| `address/`                                                         | `StreetAddress` — a shared GraphQL + DB value type (no separate doc)                                                                                                                                               |
| [`middleware/`](./source/router/CLAUDE.md)                         | Global + handler middleware — see the [HTTP doc](./source/router/CLAUDE.md)                                                                                                                                        |
| [`access-control/`](./source/access-control/CLAUDE.md)             | Session-based access control: `@RequireSessionAccess`/`@WithSessionAccess`, `SessionContext`, the pluggable `SessionContextProvider` seam                                                                          |
| [`test/`](./source/test/CLAUDE.md)                                 | `IntegrationTestClient` + test environment setup                                                                                                                                                                   |

**[`internal/`](./source/internal/CLAUDE.md)** — not exported. Platform delegates (`cloudflare/`, `node/`), and the dispatch/runtime machinery behind the public subsystems (`router/`, `graphql/`, `queue/`, `request/`, `rpc/`, `scheduled/`, `web-socket/`, `dependency-injection/`, `metadata/`, `middleware/`, `execution-context/`). See the [internal map](./source/internal/CLAUDE.md).

## Key dependencies

Runtime: `base-common`, `base-client`, `smol-toml`.
Peer (provided by the consuming worker): `tsyringe` (DI), `type-graphql` + `graphql` + `graphql-yoga` + `graphql-scalars` + `graphql-type-json` (GraphQL), `itty-router` (routing), `drizzle-orm` (ORM), `better-sqlite3` + `@planetscale/database` (DB drivers), `@cloudflare/containers` (Durable Objects), `@whatwg-node/server` + `ws` (Node serving / WebSocket). `reflect-metadata` underpins the decorators.

## Relationship to other packages

→ `common` (types, error model, decorator registry, protocol, utilities) and `client` (injects `RpcClient` for outbound RPC). ← consumed by `cli` (loads `BaseSettings`, drives build/deploy/migrations). The `examples/` workers exercise it end-to-end.
