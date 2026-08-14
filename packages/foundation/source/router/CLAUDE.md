# router/ — HTTP request handling

This doc covers the whole HTTP path: **routing** (`router/`), the **request context** app code sees (`request/`), **middleware** (`middleware/`), and HTTP helpers (`http/`). The public surface is here; the dispatch engine is `internal/router/BaseRouter.ts`.

## Defining routes

```ts
@HttpService()                                  // marks the class as a route-handler entry point
export class AccountService {
  @HttpRoute('POST', '/accounts')
  async create(
    @HttpBody(() => CreateAccountInput) input: CreateAccountInput,  // typed JSON: deserialized + validated
    @HttpQuery('expand') expand: string,
    @InjectRequestContext() rc: RequestContext,
  ): Promise<Response> { ... }
}
```

List the service class in a module's (or the worker's) `services` — its `@HttpService` decorator sorts it into the route surface. `@HttpService()` marks the class (in `DecoratorRegistry` + router metadata) and the engine resolves a fresh instance from the `@request` container per request.

### Decorators

| Decorator                     | Injects                                                                                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@HttpService()`              | class — the entry point; routes inside it are bound at boot                                                                                                                    |
| `@HttpRoute(method, path)`    | method — registers a route (method(s), path, handler name, param count)                                                                                                        |
| `@HttpBody(...)`              | the body — `ReadableStream` by default; `@HttpBody(() => Type)` deserializes JSON + class-validates; `@HttpBody({ mode })` for `stream`/`formData`/`text`/`arrayBuffer`/`blob` |
| `@HttpQuery(name)`            | a query-string value                                                                                                                                                           |
| `@HttpPath(name)`             | a path parameter                                                                                                                                                               |
| `@HttpHeader(name)`           | a request header                                                                                                                                                               |
| `@HttpCookie(name)`           | a cookie                                                                                                                                                                       |
| `@InjectRequestContext(key?)` | the whole `RequestContext`, or a keyed extension value (see below)                                                                                                             |

## `RequestContext` (`request/`)

The app-facing, **read-only** projection of the request — obtained via `@InjectRequestContext()` and usable identically across HTTP routes, RPC handlers, and GraphQL resolvers. It deliberately does _not_ expose the raw `Request` body/stream (to avoid accidental double-reads / leaks). It carries:

- request metadata — `requestId`, `url`, `method`, `route`, `headers`;
- caller info — `RequestOrigin` (parsed `Accept-Language` → language preferences, plus timezone and geo `city`/`region`/`country`/`lat`/`long`, sourced from the platform delegate's request properties, i.e. Cloudflare's `cf`);
- capabilities — the DI `container`, the `BaseEventBus`, `DeferredActions`, and a `ResponseWriter` (`setCookie` / `appendHeader`) for influencing the outgoing response from inside a handler;
- `handler` (`BaseHandler`) — set once the dispatcher resolves the target method (so handler middleware and deferred actions can see what's running);
- a **typed extension bag** — `get`/`set`/`require` keyed by `RequestContextKey` (a branded `TypedKey`), where modules stash per-request values (device id, session, account) without colliding. `@InjectRequestContext(SomeKey)` extracts one of these directly.

`@InjectRequestContext` is implemented with `reflect-metadata` keys (`base:requestContextIndex`, `base:requestContextExtractions`) read by every dispatcher — including the type-graphql fork — which is why those keys are plain strings (no framework import needed at the GraphQL dispatch site).

**`DeferredActions`** (`request/DeferredActions.ts`) is just `append(action)`; inject it via `BaseInjections.DeferredActions` to schedule post-response work. The per-request executor is drained (and the container disposed) by `Base.runDeferredActions` inside `executionContext.waitUntil` — see [`base/`](../base/CLAUDE.md).

## Middleware (`middleware/`)

Two phases, both registered per module (`ModuleSettings.middleware.global` / `.handler`) and run in **module dependency order**. Each is a function (`BaseMiddlewareFn`) or a DI-resolved class (`BaseMiddleware`/`HandlerMiddleware`). Semantics: return `void` → continue; return a `Response` → short-circuit; `throw` → failure.

| Phase   | Type                    | When                          | Context                                           |
| ------- | ----------------------- | ----------------------------- | ------------------------------------------------- |
| Global  | `BaseMiddleware(Fn)`    | per request, before dispatch  | `RequestContext`                                  |
| Handler | `HandlerMiddleware(Fn)` | after the handler is resolved | `HandlerRequestContext` (guarantees `rc.handler`) |

Handler middleware is for per-handler concerns (rate limiting, access control) that pair with a method decorator storing metadata the middleware reads; it can also be attached directly with `@WithMiddleware`.

## Dispatch (`internal/router/BaseRouter.ts`)

Built on `itty-router`. Lifecycle: `createRoute(...)` is called during `Base.initialize` (GraphQL/RPC/WS routes + each `@HttpRoute`); `bindRoutes()` finalizes and builds the CORS pair — routes can't be added after binding. Per request, `handleRequest`:

1. runs global middleware (short-circuits on a returned `Response`);
2. matches the route and builds the handler argument list from the param decorators — `@HttpBody(() => T)` deserializes + **class-validates** via `validate()` (a non-empty `ValidationError[]` becomes the framework's argument-validation error — see [`validation/`](../validation/CLAUDE.md));
3. resolves the `@HttpService` instance from the request container, sets `rc.handler`, runs handler middleware;
4. resolves `@InjectRequestContext()` params and invokes the handler;
5. passes the result through any registered `ResponseTransformer`s (`router/ResponseTransformer.ts`, resolved via the `BaseInjections.ResponseTransformer` string token).

## Settings & helpers

- `router/RouterSettings.ts` — CORS (`preflight`, `allowedOrigins`, `allowedMethods`, `allowedHeaders`, `exposedHeaders`, `allowCredentials`, `maxAge`), plus path `rewrite` rules (applied in `Base.handleRequest`) and the base `route`.
- `http/` — `Headers.ts` and `HttpResponses.ts` (response construction helpers). Lower-level HTTP constants (methods, status, cookies, media types) live in [`base-common/http`](../../../common/CLAUDE.md).

## See also

[`graphql/`](../graphql/CLAUDE.md) and [`rpc/`](../rpc/CLAUDE.md) (other dispatchers that share `RequestContext` + `@InjectRequestContext`) · [`base/`](../base/CLAUDE.md) (`BaseRequest`, deferred-action draining).
