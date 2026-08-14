# access-control/ — session-based access control

The framework's auth idiom: decorate a handler with what it requires, plug in one provider that says who is asking, and the framework enforces the rest. The contract (decorators, options, identity interface, provider seam) lives here; the enforcement machinery is in [`internal/access-control/`](../internal/CLAUDE.md).

## The model

Three pieces, with a sharp line between them:

1. **Declaration** — `@RequireSessionAccess({ roles?, entitlements? })` or `@WithSessionAccess(...)` on a handler class or method (any dispatch surface: HTTP, RPC, GraphQL). `@RequireSessionAccess` rejects anonymous requests (401); `@WithSessionAccess` loads the identity if present but lets anonymous requests through. Both write `SessionAccessOptions` into the internal metadata registry, keyed by handler identifier. Class + method options merge: role/entitlement lists concatenate, `skipAuthorization` ORs.
2. **Identity (the provider seam)** — the app registers exactly **one** `SessionContextProvider` class via the `accessControl: { provider }` settings slot (worker settings, or a module's settings for apps whose identity system lives in a module — the same idiom as `graphql.type` and `orm.adapter`). The class is resolved from the request-scoped DI container, so it can inject services. Its single method resolves a request into a `SessionContext` or `null` ("not signed in"). Throwing is reserved for provider-policy failures (device requirements, suspended accounts) — the provider owns _who you are_ and any app-specific policy, including exposing only currently-valid role/entitlement strings. `resolve(requestContext, options)` receives the handler's merged `SessionAccessOptions`, so policy can depend on them (e.g. enforce a device requirement only when authorization will run); it is called once per decorated handler — a provider whose identity lookup is expensive caches it per request (read `SessionContextRequestKey` before hitting the session store).
3. **Enforcement (generic, framework-owned)** — the session-access middleware runs first among handler middleware, unconditionally, on every dispatch surface; handlers without access-control metadata pass straight through, so decorating a handler is the only registration needed. For decorated handlers it resolves the identity through the provider (stored under `SessionContextRequestKey`), then authorizes: no session → **401 `AUTHENTICATION_REQUIRED`**; required roles unmatched → **403 `PERMISSION_DENIED`**; required entitlements unmatched → **403 `INSUFFICIENT_ENTITLEMENTS`**. Matching is **any-of** for both; an empty requirement list passes.

Registration contradictions fail at boot, in `BaseAppManifest.validate()`: a **registered** handler (router/GraphQL/RPC) carrying access-control metadata with no provider registered is an error, and so are two different provider registrations — a decorated handler can never sit silently unenforced. Scoping the check to registered handlers matters because decorators run at import time: a worker that merely imports a module containing decorated handlers (without registering them) must not be forced to carry a provider.

## Identity model

`SessionContext` is session + account + actor: `accountId` is who authenticated; `actorId` is who is acting — the key modules use for row ownership (an account acting through one of several profiles is the canonical reason they differ; implementations may set them equal). `getActor()` returns the implementation's actor object, typed via the `ActorType` parameter. The framework contract never says "profile" — that's one implementation's name for its actor.

## Files

| File                                                                     | Role                                                                                      |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `decorators/RequireSessionAccess.ts` / `decorators/WithSessionAccess.ts` | The handler decorators (class or method)                                                  |
| `SessionAccessRequirements.ts`                                           | The decorator parameter: `{ roles?, entitlements? }`                                      |
| `SessionAccessOptions.ts`                                                | The handler's effective record: requirements + `skipAuthorization` (set by the decorator) |
| `SessionContext.ts`                                                      | The resolved identity interface (`SessionContext<ActorType>`)                             |
| `SessionContextProvider.ts`                                              | The one-method seam apps implement                                                        |
| `AccessControlSettings.ts`                                               | The `accessControl: { provider }` settings slot type                                      |
| `SessionContextRequestKey.ts`                                            | Request-context key the resolved identity is stored under                                 |

The three error codes (`AUTHENTICATION_REQUIRED`, `PERMISSION_DENIED`, `INSUFFICIENT_ENTITLEMENTS`) live in the framework's [`error/ErrorCode.ts`](../error/CLAUDE.md) union, alongside the other codes foundation itself produces (`VALIDATION_ERROR`, …).

Machinery in `internal/access-control/`: `AccessControlMetadata.ts` (module-scope singleton registry), `UseSessionAccess.ts` (shared decorator implementation), `SessionAccessMiddleware.ts` (enforcement). The provider registration is aggregated and validated by `BaseAppManifest` ([configuration/](../configuration/CLAUDE.md)).

## Reading the identity in a handler

```ts
import { SessionContextRequestKey } from '@system-inc/base-foundation/access-control/SessionContextRequestKey';

@RequireSessionAccess()
async myHandler(requestContext: RequestContext) {
    const sessionContext = requestContext.require(SessionContextRequestKey);
    // sessionContext.accountId, sessionContext.actorId, sessionContext.hasAccessRole('Administrator'), ...
}
```

Under `@WithSessionAccess`, use `get(...)` instead of `require(...)` — the key is unset for anonymous requests.

## See also

The example provider in `examples/test-worker` (reference implementation + integration tests) · [`router/`](../router/CLAUDE.md) (handler middleware pipeline) · [`dependency-injection/`](../dependency-injection/CLAUDE.md) (`@Provider`, typed injection keys).
