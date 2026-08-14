# Base documentation

Hand-written documentation for the Base framework, published to
[base-framework.dev/documentation](https://base-framework.dev/documentation). The folder
structure is the site's topic tree, following the [Diátaxis](https://diataxis.fr/)
taxonomy:

- **`getting-started/`** — the entry point: install to deployed, step by step.
- **`guides/`** — how-to recipes: one task, for someone who knows the basics.

The API **reference** is not authored here — it is generated from TSDoc by
`scripts/reference-gen/` and synced to the site directly.

## Articles

### Getting Started

1. [Installation](./getting-started/01-installation.md): scaffold a
   workspace, start the dev server, see your worker respond.
2. [Your First Worker](./getting-started/02-your-first-worker.md): the three
   files that make a worker, then build a typed, validated JSON API.
3. [Add a Database](./getting-started/03-add-a-database.md): entities,
   migrations, and repositories on Cloudflare D1.
4. [Add GraphQL](./getting-started/04-add-graphql.md): a typed resolver over
   the same data, explored in GraphiQL.
5. [Deploy to Cloudflare](./getting-started/05-deploy-to-cloudflare.md):
   release migrations and ship to the edge.
6. [Call Your Worker with RPC](./getting-started/06-call-your-worker-with-rpc.md):
   the notes API as typed method calls over one shared interface.

### Guides · How Base Works

1. [Decorators and Boot](./guides/framework/01-decorators-and-boot.md): what a
   decorator records at script evaluation, how the app is assembled on the first
   event, and what runs per event.

### Guides · HTTP

1. [Define a Route](./guides/http/01-define-a-route.md): `@HttpService`,
   `@HttpRoute`, response handling, errors.
2. [Read Request Parameters](./guides/http/02-read-request-parameters.md): typed
   path and query parameters, query-object binding.
3. [Validate Request Bodies](./guides/http/03-validate-request-bodies.md): typed
   validated bodies, raw JSON, body modes.
4. [Headers and Cookies](./guides/http/04-headers-and-cookies.md): reading both as
   arguments; setting them on responses.
5. [Middleware](./guides/http/05-middleware.md): global vs handler middleware,
   typed context keys.
6. [CORS](./guides/http/06-cors.md): the environment-keyed allowlist, credentials.

### Guides · ORM

1. [Define an Entity](./guides/orm/01-define-an-entity.md): decorated classes,
   explicit column types, the `declare` rule.
2. [Relations](./guides/orm/02-relations.md): many-to-one, one-to-many, junction
   tables instead of many-to-many, loading.
3. [Migrations](./guides/orm/03-migrations.md): generate → run → release; the
   supporting commands.
4. [Query Data](./guides/orm/04-query-data.md): equality shorthand, filter
   functions, order/limit/offset, counting.
5. [Write Data](./guides/orm/05-write-data.md): `from` + `insert`, change-tracked
   updates, upsert, delete, batching.
6. [Lifecycle Hooks](./guides/orm/06-lifecycle-hooks.md): before/after
   insert/update/delete, after-load.
7. [Multiple Databases](./guides/orm/07-multiple-databases.md): named databases,
   `DatabaseBinding`, module-aware routing.

### Guides · RPC

1. [Use RPC](./guides/rpc/01-use-rpc.md): define typed procedures; the default
   calling path for your own frontends and workers.
2. [Call a Worker from the Web](./guides/rpc/02-call-from-the-web.md): the
   browser client, options, retries, error handling.
3. [Share Types](./guides/rpc/03-share-types.md): the contract interface file;
   monorepo type sharing with the frontend.
4. [Worker-to-Worker Calls](./guides/rpc/04-worker-to-worker.md): typed clients
   over Cloudflare service bindings, internal visibility.

### Guides · Dependency Injection

1. [Inject Services](./guides/dependency-injection/01-inject-services.md):
   `@Injectable` + `@Inject`, optional/lazy variants, typed tokens.
2. [Lifetimes and Scopes](./guides/dependency-injection/02-lifetimes-and-scopes.md):
   the scope tree, `@ContainerScoped` vs `@WorkerScoped` vs `@Singleton`.
3. [Typed Keys and Providers](./guides/dependency-injection/03-typed-keys-and-providers.md):
   `TypedInjectionKey`, `@Provider`, interface/implementation patterns.

### Guides · Request Context

1. [Use the RequestContext](./guides/request-context/01-use-the-request-context.md):
   read request state, write response state, defer post-response work, typed keys.

### Guides · GraphQL

1. [Define Types](./guides/graphql/01-define-types.md): object and input classes,
   nullability parity, nesting.
2. [Write Resolvers](./guides/graphql/02-write-resolvers.md): queries, mutations,
   typed arguments, operation context.
3. [The Schema Workflow](./guides/graphql/03-schema-workflow.md): SDL snapshots,
   breaking-change checks, CI gating.

### Guides · Validation

1. [Validate Input](./guides/validation/01-validate-input.md): one pipeline for
   HTTP/GraphQL/RPC, the 422 error shape.
2. [Validation Rules](./guides/validation/02-validation-rules.md): the full rule
   catalog, array-level rules, `.check()` predicates.
3. [Custom Rules](./guides/validation/03-custom-rules.md): `registerRule`, options,
   custom messages.

### Guides · Serialization

1. [Serializable Objects](./guides/serialization/01-serializable-objects.md):
   opt-in wire shapes, field options, 400 vs 422, `StrictJsonInterface`.
2. [Transformers](./guides/serialization/02-transformers.md): built-in and custom
   value transformers.

### Guides · Testing

1. [Unit Tests](./guides/testing/01-unit-tests.md): plain jest, plain
   constructors, the config that keeps it that way.
2. [Integration Tests](./guides/testing/02-integration-tests.md): the live-worker
   harness, one client for REST/GraphQL/RPC, host resolution.
3. [Test Modules](./guides/testing/03-test-modules.md): `moduleTest` and the host
   worker pattern.

### Guides · Modules

1. [Create a Module](./guides/modules/01-create-a-module.md): key, factory,
   settings, lifecycle hooks.
2. [Settings and Dependencies](./guides/modules/02-settings-and-dependencies.md):
   the seven slots, `uses`, feature-scoped dependencies.
3. [Registration Modifiers](./guides/modules/03-registration-modifiers.md):
   feature toggles, `externalSchema`, `database`.
4. [Composition Patterns](./guides/modules/04-composition-patterns.md):
   core/client splits, shared databases, the four axes.

### Guides · Storage

1. [Key-Value Storage](./guides/storage/01-key-value-storage.md): declaring and
   injecting Cloudflare KV, get/put/list, consistency caveats.
2. [Object Storage](./guides/storage/02-object-storage.md): public and private R2
   buckets, streaming, folder-style listing.
3. [Durable Objects](./guides/storage/03-durable-objects.md): a worker with its own
   SQLite, bundled migrations, serialized state, per-name instances, typed RPC
   handles, alarms.
4. [Containers](./guides/storage/04-containers.md): a Base worker in Docker;
   native deps, the container/ layout, typed calls across the boundary.

### Guides · Queues

1. [Send Messages](./guides/queue/01-send-messages.md): bindings, typed
   producers, `{ type, payload }` envelopes.
2. [Process Messages](./guides/queue/02-process-messages.md): processors,
   per-message vs batch, ack/retry semantics, DLQs.

### Guides · Scheduled Tasks

1. [Scheduled Tasks](./guides/scheduled/01-scheduled-tasks.md):
   `@ScheduledExecutable`, cron constants, triggers, local testing, alarms.

### Guides · Events

1. [Use the EventBus](./guides/events/01-event-bus.md): events, listeners,
   `publish` vs `defer`, events vs queues, the unhandled-exception event.

### Guides · WebSockets

1. [Use WebSockets](./guides/websockets/01-websockets.md): delegates, authorized
   upgrades, pushing to sockets, session context mappings.

### Guides · Security

1. [Access Control](./guides/security/01-access-control.md):
   `@RequireSessionAccess`, roles/entitlements, the session context provider.
2. [Encryption](./guides/security/02-encryption.md): `base keygen`,
   `ENCRYPTION_KEYS`, encrypted tokens and rotation.

### Guides · CLI

1. [CLI Fundamentals](./guides/cli/01-cli-fundamentals.md): invocation, worker and
   workspace resolution, environments, `base info`.
2. [Develop and Build](./guides/cli/02-develop-and-build.md): the daily loop of
   develop, check, bundle, and tail, plus scaffolding.
3. [Command Reference](./guides/cli/03-command-reference.md): every command,
   subcommand, and option.

### Guides · Deployment

1. [Environments and Configuration](./guides/deployment/01-environments-and-configuration.md):
   the three config layers, variable flow, `deployEnvironment`.
2. [Read Configuration](./guides/deployment/02-read-configuration.md): typed
   environment keys, required values, `Secret` wrapping, module settings.
3. [Deploying](./guides/deployment/03-deploying.md): the gates,
   `--all-workers`, credentials, release metadata.
4. [Continuous Deployment](./guides/deployment/04-continuous-deployment.md) — the
   scaffold's pipeline and secrets flow.
5. [Run on Node](./guides/deployment/05-run-on-node.md): the same worker as a plain
   Node process; what the platform delegate does and doesn't carry across.

### Guides · Debugging

1. [Debugging](./guides/debugging/01-debugging.md): inspector ports, the VS Code
   configurations, logs, tail.

### Guides · Logging

1. [Logging](./guides/logging/01-logging.md): the level-gated `Logger`,
   `LOG_LEVEL` and per-category thresholds, the request-log switch.

## Authoring

Each `.md` file is one article; frontmatter needs `title` and `description`. Numeric
filename prefixes set ordering, `_topic.yaml` files title the sections. Article
files must match `NN-name.md`; the identifier is the name part (or frontmatter
`identifier:`) and is capped at 24 characters and globally unique.
