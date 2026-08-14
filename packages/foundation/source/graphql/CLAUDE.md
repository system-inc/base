# graphql/ — GraphQL

Decorator-defined GraphQL built on [type-graphql](https://typegraphql.com) and served via [graphql-yoga](https://the-guild.dev/graphql/yoga-server). You write decorated resolver/type classes; the framework builds the schema (wired to Base's DI, validation, and middleware) and serves it on a single route. The public surface is here; the per-worker orchestrator is `internal/graphql/GqlDispatcher`.

## How it's wired

```
GqlSettings.type (a GqlServerProvider class)
        │
   Base.initializeGql() ──► route (POST /graphql, +GET when graphiql) ──► GqlDispatcher
                                                                              │ lazy, first request
                                                                              ▼
                                                  provider.getGqlServer(config)  (GraphQLYoga)
                                                       │
                                                 gqlBuildSchema(config)  ──► type-graphql buildSchema
                                                       │                        + Base DI / validate() / GqlMiddleware
                                                       ▼
                                                 graphql-yoga server { schema, handleRequest }
```

You list resolver classes in a module's (or the worker's) `services` — their `@GqlResolver` decorator sorts them into the schema — and set `graphql.type` to a provider (normally `GraphQLYoga`). `Base` registers the route and defers to `GqlDispatcher`, which lazily asks the provider to build the server on the first request.

## Decorators (`decorators/`)

type-graphql wrappers renamed to Base's `Gql*` convention, plus Base extensions:

| Decorator                                                      | Purpose                                                                           |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `@GqlResolver()`                                               | marks a resolver class (also `mark`ed in `DecoratorRegistry` for boot validation) |
| `@GqlQuery()` / `@GqlMutation()`                               | query / mutation methods                                                          |
| `@GqlFieldResolver()`                                          | computed field resolver                                                           |
| `@GqlObjectType()` / `@GqlInputType()` / `@GqlInterfaceType()` | type definitions                                                                  |
| `@GqlField()`                                                  | a field on a type                                                                 |
| `@GqlArgument()` / `@GqlArguments()` / `@GqlArgumentsType()`   | operation arguments                                                               |
| `@GqlRootObject()`                                             | inject the resolver root                                                          |
| `@GqlOperationContext()` (`@InjectGqlOperationContext<T>`)     | inject the typed operation context                                                |

`@InjectRequestContext()` (from [`request/`](../router/CLAUDE.md)) also works in resolvers — the request context is shared across all dispatchers.

## The provider abstraction

`GqlServerProvider.getGqlServer(config)` owns schema construction and all third-party server wiring; it returns a `GqlServer` (`{ type, schema, handleRequest }`). This split exists so the **heavy GraphQL dependencies only land in workers that actually import a provider** — `GqlDispatcher` itself is intentionally dependency-free.

`GraphQLYoga` (`providers/GraphQLYoga.ts`) is the bundled provider:

- builds the schema via `gqlBuildSchema`, then `printSchema` + `createResolversMap` into a yoga `createSchema`/`createYoga`;
- masks errors through `gqlMaskError`;
- gates GraphiQL on `config.graphiql`;
- adds `NoSchemaIntrospectionCustomRule` when `config.introspection` is off;
- **sets `cors: false`** — Yoga's default CORS reflects any Origin with credentials (the textbook credentialed-CORS misconfiguration); `BaseRouter` wraps the handler and applies its own allowlist instead, so Yoga's headers are suppressed to avoid winning over the router's.

## `gqlBuildSchema` — the shared schema builder

`GqlBuildSchema.ts` is provider-agnostic (any type-graphql-based provider can reuse it). It configures type-graphql to integrate with Base rather than type-graphql's defaults:

- **DI:** resolvers are resolved from the request's Base container (`resolverData.context.request.context.container.resolve`), not type-graphql's container.
- **Auth:** `authMode: 'error'` — the `@Authorized` decorator is intentionally disabled; auth is handled by Base middleware (the single `globalMiddlewares: [GqlMiddleware]`).
- **Validation:** a custom `validateFn` runs Base's `validate()` and throws `ArgumentValidationError` on failure — so validation behaves identically across HTTP, RPC, and GraphQL (see [`validation/`](../validation/CLAUDE.md)).
- passes through `config.directives`.

`GqlContext` and `GqlMiddleware` (in `internal/graphql/`) are the context shape and the single global middleware (auth) used during execution.

## Settings (`GqlSettings`)

`type` (provider class), `route` (default `/graphql`), `directives`, and two **env-aware security toggles**: `graphiql` and `introspection` each default to `true` in development and `false` in production (override explicitly). Disabling introspection in prod stops anonymous clients from enumerating the schema; consume the schema from dev for codegen.

## Supporting types

- **Pagination / filtering / ordering:** `PaginationInput`, `PaginationResult`, `OrderByInput`, `ColumnFilter`, `OperationResult`, `TimeSeriesGql` — the GraphQL-facing counterparts to the ORM's find options. A bare `PaginationInput` argument is _plain pagination only_: client `filters` and `orderBy` are rejected at runtime. To accept them, declare a per-operation subclass with `@PaginationInputFor(Entity, { filterColumns, orderColumns })` (`decorators/PaginationInputFor.ts`; the declaration registry it writes to is `PaginationInputMetadata.ts`) — the decorator registers the subclass as a named input type whose `filters`/`orderBy` fields are typed with generated per-column enums (the allowlist lives in the schema and fails GraphQL validation before resolver code runs), and `OrmPaginationInput.from` reads the same declaration to enforce the allowlists at runtime. Column names are typed as keys of the entity (`OrmEntityKey<Entity>`, the ORM find-options idiom — a typo is a compile error) and validated against the entity's ORM metadata at class-definition time. (`base-lint`'s `pagination-decorator` rule enforces that `*PaginationInput` args are named `pagination`/`*Pagination`.) A resolver that can't use `ormPaginatedFind` (GROUP BY, hand-written join) assembles its result's `Pagination` with `buildPagination` (`BuildPagination.ts`) — the same arithmetic the find layer uses, so hand-rolled envelopes can't drift.
- **Base entities:** `entity/GqlOrmBaseEntity`, `GqlOrmMutableBaseEntity`.
- **Scalars & type helpers:** `types/` (`GqlInteger`, `GqlBitInteger`, `GqlJson`, `GqlJsonObject`, `GqlCreateUnionType`, `GqlRegisterEnumType`) and `GqlMediaObject`.

## Lint parity

`base-lint` keeps decorators and TS types in sync: `gql-nullable-parity` (declared nullability vs type) and `gql-operation-context-matches-return` (`@InjectGqlOperationContext<T>` generic vs resolver return type). See the [lint doc](../../../lint/CLAUDE.md).

## See also

[`router/`](../router/CLAUDE.md) (owns the route + CORS) · [`validation/`](../validation/CLAUDE.md) · [`base-common/graphql`](../../../common/CLAUDE.md) (shared input/scalar types).
