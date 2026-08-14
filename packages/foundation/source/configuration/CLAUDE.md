# configuration/ — runtime config & app manifest

The read-only, injectable view of a worker's configuration. `BaseConfiguration` wraps the `BaseSettings` + environment variables, exposes the runtime environment (env/mode/platform), gates environment-variable access through typed keys, and lazily flattens the module graph into a `BaseAppManifest` that the engine and dispatchers consume.

## `BaseConfiguration`

Constructed by `BaseWorkerContext` from `(environmentVariables, settings)` and registered in the `@worker` container, so any service can `@Inject(BaseConfiguration)`. It is **read-only** — a typed projection over settings, not a place to mutate state. Key getters: `name`, `title`, `version`, `runtime`, `delegate`, `modules`, `router`, `graphql`, `rpcClient`, `rpcServer`, `scheduled`, `eventBus`, `logging` (settings default + `categories` + the `LOG_LEVEL` env directive + `requestLog` with its default applied; `Base.initializeLogging` applies it at boot), `keyValueStorage`, `objectStore`, `queue`, `durableObjects`, `containers`, `webSocket`, `middleware`, `cli`. `instanceId` is a per-instance uuid.

### Environment variables are not exposed directly

`EnvironmentVariables` (the raw bag, e.g. `PLATFORM`, `ENVIRONMENT`, `EXECUTION_MODE`, `RUN_CONFIG`, `PORT`, plus your own — it maps to the worker's `env.toml`) is **not** handed out wholesale, because it may contain secrets. Instead you declare a typed `BaseEnvironmentKey` and read one value at a time:

```ts
const CommitSha = BaseEnvironmentKey.create<string>('COMMIT_SHA');
const StripeKey = BaseEnvironmentKey.createSecret('STRIPE_SECRET_KEY');

configuration.getEnvironmentVariable(CommitSha); // string | undefined
configuration.getEnvironmentVariable(StripeKey); // Secret<string> | undefined
configuration.requireEnvironmentVariable(StripeKey); // throws if missing
```

`createSecret` keys are auto-wrapped in `Secret<T>` by the loader, so the value can't reach logs/JSON without an explicit `.reveal()`. `BaseEnvironmentKey` extends `TypedKey<T, 'environment'>` — its `'environment'` brand keeps it from being confused with module/request/websocket keys. `BaseEnvironmentKeys` holds the framework's own keys (Environment, ExecutionMode, Platform, …). Module settings are read the same typed way via `BaseModuleKey` + `getModuleSettings(key)` (`BaseModuleKey` also lives here; see [`module/`](../module/CLAUDE.md)).

## `Runtime` (`configuration.runtime`)

Bundles three derived values, each parsed from an env var:

| Class           | Enum                                                              | Default            | Helpers                         |
| --------------- | ----------------------------------------------------------------- | ------------------ | ------------------------------- |
| `Environment`   | `EnvironmentType`: Development / Production                       | Development        | `isDevelopment`, `isProduction` |
| `Platform`      | `PlatformType`: CloudflareWorker / CloudflareDurableObject / Node | CloudflareWorker\* | `isCloudflare`, `isNode`        |
| `ExecutionMode` | `ExecutionModeType`: Default / CommandLine / Test / Local         | Default            | `isCommandLine`, …              |

\* Platform defaults to Cloudflare because Cloudflare doesn't set a `PLATFORM` env var. `Platform.type` is what `Base` switches on to pick the platform delegate; `ExecutionMode.isCommandLine` is why `Base` uses a `DummyRouter` under the CLI; `EnvironmentType` gates dev-only behavior (e.g. unreleased-migration deploy checks).

## `BaseAppManifest`

`BaseConfiguration` lazily builds one via `BaseAppManifest.fromSettings(settings)`. It **flattens the whole module dependency graph** (a worker's modules + everything they `use`) into aggregated, deduplicated registries: each `services` class (module or worker level) is **sorted by its decorator marks** into the dispatch buckets — `graphql` resolvers, `router` services, `rpc` services, `queue` processors, `scheduled` executables, `eventBus` listeners — alongside `orm` entities, `graphql` directives, `webSocket` delegates, and `middleware`. This is the single flat structure the engine and dispatchers read instead of re-walking modules.

### Boot-time validation

Sorting itself is the dispatch-surface check: a `services` class with **no recognized Base decorator** (dispatch, injectable-family, or `@Provider` host) throws while the manifest flattens — it could do nothing, so listing it is a mistake, usually a forgotten decorator. `manifest.validate()` then checks what sorting can't: `orm[name].entities`/`externalEntities` must carry `@OrmTable` (entities are registered directly, not sorted), a registered router/GraphQL/RPC handler carrying access-control decorators requires a registered `accessControl.provider` — imported-but-unregistered decorated classes don't (and two different provider registrations are a conflict caught at registration), and declared module membership (`@Injectable(SomeModuleKey)`) must agree with the module graph — the named module must be registered in the worker, a registered class's declared module must not resolve to a different database than its registering module, and a class with token-less ORM injections in a non-default-database module must declare its membership. (`webSocket.delegates` is intentionally not validated — its settings type already constrains the shape structurally and there's no companion decorator.)

## See also

[`base/`](../base/CLAUDE.md) (consumes `runtime` + the manifest during `initialize`) · [`module/`](../module/CLAUDE.md) (`BaseModuleKey`, module settings).
