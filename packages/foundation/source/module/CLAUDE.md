# module/ — the composition unit

A `BaseModule` is a self-contained, reusable bundle of functionality (entities, resolvers, route services, queue processors, scheduled jobs, RPC procedures, event listeners, middleware, provider hosts — all via `services`). A worker is assembled by listing modules in `BaseSettings.modules`; modules can depend on other modules and contribute their own typed settings.

## Files

| File                       | Role                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------- |
| `BaseModule.ts`            | The `BaseModule` class + `BaseModule.create`, `BaseModuleCreate`, `BaseModuleOptions` |
| `ModuleSettings.ts`        | `BaseModuleSettings` (the registration surface) + `ModuleSettings<T>`                 |
| `WorkerConfigValidator.ts` | A CLI `check`-command extension point (see note below)                                |

## Defining a module

```ts
export const StripeModuleKey =
    BaseModuleKey.create<StripeModuleSettings>('Stripe');

export const StripeModule = BaseModule.create({
    key: StripeModuleKey, // the module's identity — infers + enforces the settings type
    uses: [BillingModuleKey], // declares dependencies on other modules
    settings: {
        orm: { entities: [Charge, Customer] },
        // classes self-describe: @GqlResolver / @WorkerQueueProcessor / …
        services: [BillingResolver, WebhookProcessor],
        // ...module-specific settings merged in via the key's <T> generic
    },
    onInitialize: async (settings, configuration) => {
        /* runs at boot */
    },
});
```

`BaseModule.create(create, options?)` constructs the module and immediately calls `onCreate()`. The constructor is private — always use `create`. The `key` is the module's single identity object — the same `BaseModuleKey` used in other modules' `uses`, in `configuration.getModuleSettings(key)`, and in declared membership (`@Injectable(StripeModuleKey)`); passing it here (rather than a string name) makes the name single-sourced and binds the key's phantom settings type to the module's actual settings at compile time.

### `settings` (`BaseModuleSettings`) — what a module registers

Each key registers classes/values into the corresponding subsystem:

| Key             | Registers                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `services`      | **the single class slot** — every class the module contributes, sorted into dispatch surfaces by its decorators (`@GqlResolver`, `@HttpService`, `@RpcService`, `@WorkerQueueProcessor`, `@ScheduledExecutable`, `@EventBusListener`; a multi-decorator class lands in each matching bucket, honoring this registration's feature toggles). `@Provider` hosts and injectable-family classes are loaded so their registrations run. A class with no recognized Base decorator is a **boot error** |
| `orm`           | Drizzle `entities` (owned) + `externalEntities` (tables it queries but doesn't own — reference another module's exported `*Schema` array) (+ optional `databaseName`)                                                                                                                                                                                                                                                                                                                            |
| `graphql`       | `directives` (GraphQL directive instances)                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `webSocket`     | `delegates` (config objects: delegate + name/path/rpcEndpoint), `mappings` (copy `RequestContext` values into `WebSocketInfo` at connect)                                                                                                                                                                                                                                                                                                                                                        |
| `middleware`    | `global` (per-request) and `handler` (per-handler, after `rc.handler` resolves) — run in **module dependency order**                                                                                                                                                                                                                                                                                                                                                                             |
| `accessControl` | `provider` — the worker's one `SessionContextProvider` (identity seam for `@RequireSessionAccess`/`@WithSessionAccess`); exactly one across the worker and all modules ([access-control/](../access-control/CLAUDE.md))                                                                                                                                                                                                                                                                          |
| `cli`           | `configValidators` (see note)                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

There are deliberately no per-kind class lists (`graphql.resolvers`, `router.services`, `rpc.procedures`, …): the dispatch decorator already declares a class's role, and a matching slot would restate the same fact — the pair could only agree or contradict. The surviving non-`services` slots all carry information that is _not a property of the class_: instance configuration (webSocket mount paths), cross-class ordering (middleware), per-registration relationships (owned vs external entities), or values that aren't classes (directives, validators). The same `services` slot exists at the worker level (`BaseSettings.services`).

`ModuleSettings<T> = BaseModuleSettings & T` — a module can add its own typed settings (the `<T>` generic) on top of the standard keys.

### `uses` and lifecycle

- `uses: ModuleUse[]` declares dependencies on other modules. This ordering drives **middleware execution order** and initialization order. An entry is either a bare `BaseModuleKey` (always required) or a **feature-scoped** `{ module, when? }` — required only while that feature is enabled, so a `{ module: Account, when: 'graphql' }` dependency is dropped when the module is registered with `graphql: false` (`when` is optional; omitting it means "always"). `BaseModuleKey` (`configuration/BaseModuleKey.ts`) is a branded `TypedKey<T, 'module'>` binding a module name to its settings type, so `configuration.getModuleSettings(key)` returns fully-typed settings and can't be confused with request-context/env/websocket keys.
- `onCreate(settings)` — runs synchronously at `create()` time (legacy; rarely needed).
- `onInitialize(settings, configuration)` — runs during `Base.initialize()` once the `BaseConfiguration` exists. This is the place to do boot-time setup that needs config.

### Registration modifiers (`BaseModuleOptions`)

`BaseModuleOptions` is the single, uniform way a worker changes how a module participates **in that worker**. Apply them with `.with(...)` at the point of registration (preferred), or pass them to `BaseModule.create`:

```ts
modules: [
  Flow({ ... }).with({ graphql: false }),         // strip a feature for this registration
  Account({ ... }).with({ externalSchema: true }), // query-only schema (see below)
]
```

Modifiers are **recorded** by `with`/`create` and **applied once**, when `BaseAppManifest.fromSettings` flattens the module graph — never by mutating settings at construction. This keeps factories free of option-threading boilerplate (a factory just defines the module) and gives one application point regardless of how the options arrive.

- **Feature toggles** — `orm`, `eventBus`, `graphql`, `queue`, `router`, `rpc`, `scheduled`, `middleware`, `webSocket`: set to `false` to strip that dispatch feature's wiring for this registration (a `{ module, when }` dependency naming a stripped feature is dropped too). `middleware: false` is notable because a module's global middleware otherwise runs on **every** request — so a worker that wants a module's services but not its (often HTTP-assuming) middleware strips it here. Toggles control **wiring, not the bundle**: the stripped code is still imported/shipped, only its registration is skipped — to drop the _code_, import a smaller module/layer instead. (`services`/`cli` have no toggle on purpose — they're plumbing the module needs to function, not dispatch wiring.)
- **`externalSchema: true`** — register the module's entities for **queries** but do **not** own/migrate their schema here. The entities build into the runtime query schema (via `OrmConfiguration.externalEntities` → the manifest's `orm[db].externalEntities`), but are excluded from migration generation (`schema:diff`/`schema:check`) and the `schema:sync` table scope. Use it when a sibling worker sharing the database owns those tables. `inheritSchema` (a replica of another database's schema) populates the same external bucket automatically.
- **`database: '<name>'`** — route this module to a named database **in this worker**, overriding the module's own `settings.orm.databaseName`. This is the per-deployment knob for a module reused across workers: the same module can live in the default database in the main worker, but an external `connected` database inside a Durable Object whose default database is local SQLite (typically paired with `externalSchema: true`). It governs **both** where the module's entities register **and** where the token-less `@InjectRepository`/`@InjectDatabase` of the module's **declared member classes** (`@Injectable(SomeModuleKey)`, …) resolve to — see **module-aware database resolution** in the [orm doc](../orm/CLAUDE.md); registration alone never routes injections, and boot validation rejects a non-default-database module's class that injects token-lessly without declaring. The module's code is unchanged; only the worker's registration line differs.

## Note on `WorkerConfigValidator`

Despite living here, it's **not** a boot-time validator. It's registered under `settings.cli.configValidators` (module) / `BaseSettings.cli.configValidators` (worker) and run by the CLI `check` command to assert a worker's required bindings/env vars are present before deploy. See the [cli doc](../../../cli/CLAUDE.md).

## See also

[`base/`](../base/CLAUDE.md) (how modules are initialized & dispatched) · [`configuration/`](../configuration/CLAUDE.md) (`getModuleSettings`).
