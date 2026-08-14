# dependency-injection/ — DI container & decorators

A thin, **typed** layer over [tsyringe](https://github.com/microsoft/tsyringe). It adds (1) a named scope hierarchy, (2) capitalized decorator wrappers matching Base's naming convention, (3) typed tokens/bindings so injection sites can be statically checked by `base-lint`, and (4) a few custom decorators (optional/lazy injection, method providers, worker-scoped singletons).

## Scopes (`BaseInjectionContainer`)

`BaseInjectionContainer` is a tsyringe `DependencyContainer` plus a `.scope`. Six scopes:

```
@global ──► @worker ──► { @request | @queue | @scheduled | @websocket }
```

- `@global` — stateless registrations only (providers, configuration).
- `@worker` — per-worker singletons (durable objects, etc.).
- `@request` / `@queue` / `@scheduled` / `@websocket` — per-event children, all "request-like" (resolvers, context, the request's RPC/HTTP state).

Containers are created in `internal/dependency-injection/InjectionContainers.ts` (`getGlobalContainer`, `createWorkerContainer`, `createWorkerChildContainer`); `setupBaseContainer` only stamps `.scope`. The per-event core services (`DeferredExecutor`, `BaseEventBus`) are registered into each child by `Base.createChildContainer` — see [`base/`](../base/CLAUDE.md).

## Decorators (`decorators/`)

Capitalized wrappers + custom additions, **one decorator per file** (`decorators/Injectable.ts`, `decorators/Inject.ts`, …) matching every other subsystem's layout. All injection decorators take a **`BaseInjectionToken<T>`** (`BaseInjectionToken.ts`) = a class `Constructor<T>`, a `TypedInjectionKey<T>`, or a `TypedBinding` subclass. Bare strings/symbols are intentionally rejected so every token carries a static type (interop stays open via `.toString()`). `toTsyringeToken()` (in `internal/dependency-injection/InjectionTokens.ts`) converts typed keys/bindings to their string name — important because **tsyringe uses reference equality on tokens**, so the same instance must be used at registration and resolution.

| Decorator                                          | Purpose                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `@Injectable(moduleKey?)`                          | injectable, transient by default (wraps tsyringe `injectable`)                       |
| `@Inject(token)`                                   | constructor-param injection (typed)                                                  |
| `@InjectAll(token)`                                | inject all registrations as an array                                                 |
| `@InjectOptional(token)`                           | resolve, returning `undefined` (or `[]` for all) instead of throwing if unregistered |
| `@InjectAllOptional(token)`                        | optional array variant                                                               |
| `@InjectLazy(token)`                               | inject a `LazyInstance<T>` resolved on first use                                     |
| `@InjectWithTransform` / `@InjectAllWithTransform` | resolve through a transform class                                                    |
| `@Singleton(moduleKey?)`                           | global singleton (same instance everywhere) — usually prefer the two below           |
| `@ContainerScoped(moduleKey?)`                     | one instance per container (a child container gets its own)                          |
| `@ResolutionScoped(moduleKey?)`                    | one instance per resolution chain                                                    |
| `@WorkerScoped(moduleKey?)`                        | one instance per `@worker` container (see mechanism below)                           |
| `@Provider(token, options?)`                       | register a method as the factory for a token                                         |

### Declared module membership (`moduleKey?`)

Every injectable-family class decorator accepts an optional **`BaseModuleKey`** declaring which module the class belongs to: `@Injectable(FileStorageModuleKey)`, `@WorkerScoped(FileStorageModuleKey)`, …. Membership is stored in `ModuleMembership.ts` (a WeakMap keyed by constructor; subclasses inherit unless they declare their own; declaring two different modules on one class throws). Its consumer is **module-aware database resolution**: a token-less `@InjectRepository`/`@InjectDatabase` resolves to the declared module's database in the running worker, else the default — the declaration is the **only** thing that routes; registering a class in module settings does not. Any class in a non-default-database module that injects token-lessly must therefore carry the key (`BaseAppManifest.validate()` rejects it at boot otherwise, and also cross-checks declarations against the module graph). See the [orm doc](../orm/CLAUDE.md) for the full resolution ladder.

### `@WorkerScoped()` mechanism

`@Singleton` lives on the global container, so it would leak state across workers (a real hazard for Durable-Object-side services). `@WorkerScoped()` instead registers a **factory on the global container** that walks up parents (`getWorkerContainer`) to find the `@worker` container, lazily registers + resolves the class there, and caches the instance on that worker container. Result: one instance per worker, resolvable from any child.

### `@Provider` and `ObjectFactory`

`@Provider(token)` registers a (static or instance) method as the factory for `token` on the global container; on resolution the method is invoked on the correctly-scoped container. If the method returns an `ObjectFactory<T>` (a class wrapper around a tsyringe factory + token), it's unwrapped via `createInstance(container)` so the resolution happens on the right scope. `options.factoryType: 'caching'` wraps it in `instanceCachingFactory`. Optional/lazy injection are implemented the same way: they register synthetic `@optional(...)`/`@lazy(...)` tokens whose factories catch the unregistered-token error or wrap a `LazyInstance`.

## Typed tokens & bindings (the lint contract)

These exist so `base-lint` can verify DI wiring at compile time:

- **`TypedInjectionKey<T>`** — a named token that carries the resolved type `T`. Define as a `static readonly` member of an `*Injections` class; use with `@Provider`/`@Inject`. The `inject-type-matches-parameter` lint rule checks the consumer's parameter type matches `T`.
- **`TypedBinding`** (abstract) — names an external resource (Durable Object namespace, queue, R2 bucket, KV namespace, RPC binding) and carries a phantom brand per subclass, so passing a `DurableObjectBinding` where a `WorkerQueueBinding` is expected is a compile error.
- **`TypedParameterDecorator<TResolved>`** — branded `ParameterDecorator` exposing `__resolvedType`; typed inject decorators return this so the lint rule can read the contract.
- **`TypedMethodDecorator<TExpectedReturn>`** — branded `MethodDecorator` exposing `__expectedReturnType`; `@Provider` returns this so `provider-return-matches-token` can verify the method's return type.

## Other files

- `BaseInjections.ts` — system injection tokens: `BaseInjections.DeferredActions` (`TypedInjectionKey<DeferredActions>`, the per-request deferred executor — inject it to schedule post-response work) and `BaseInjections.ResponseTransformer` (kept a raw string token because `BaseRouter` does string-equality comparisons on it).
- `ObjectFactory.ts` — factory-as-class wrapper (see `@Provider`).
- `LazyResolve.ts` — `LazyResolve<T>` helper that resolves+caches a token against a container on first `get()`.
- `BaseInjectionToken.ts` / `ProviderOptions.ts` — the shared token union and factory options every decorator file imports.
- `InjectionErrors.ts` — `extractTypeOrTokenFromErrorMessage`, which `BaseRouter` uses to tell an unregistered-token failure from a real one.
- `internal/dependency-injection/InjectionTokens.ts` — `toTsyringeToken` plus the synthetic `@optional(...)`/`@lazy(...)` token builders and their factory registration.

## See also

[`base/`](../base/CLAUDE.md) (where child containers and core per-scope services are wired) · the `base-lint` [package doc](../../../lint/CLAUDE.md) (the rules that consume the typed tokens).
