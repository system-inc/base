# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- **RPC: a method without `@Rpc()` is no longer callable.** Registering an
  argument with `@RpcArgument` also declared the method a procedure, so a
  method on an `@RpcService` class that took `@RpcArgument` parameters but
  was never marked `@Rpc()` could be called over RPC, with the service's
  visibility. Only `@Rpc()` and `@WebSocketRpc()` declare procedures now.

    **Migration:** a method that was being called without `@Rpc()` now
    answers `NOT_FOUND`. Mark it `@Rpc()` if it is meant to be a procedure.

### Changed

- **RPC: procedure names must be unique across registered RPC services.**
  A call names only the procedure, and two registered services declaring
  the same name were resolved by import order, without any warning. Boot
  now fails with an error naming both classes.

    **Migration:** rename one of the colliding procedures. Services that are
    imported but not registered don't count.

- **Node: `BaseWorkerNodeRunner` binds to `server.host`.** The runner
  ignored `host` and always listened on every interface, so a Node service
  couldn't be kept local-only. It now passes the run config's `host` to
  `listen()`, the same way `base develop` passes it to `wrangler dev` as
  `--ip`. With no `host`, it still listens on every interface. A `host`
  that isn't a hostname or IP address (a URL such as
  `https://app.example.workers.dev`, used only as a `base test` target)
  now fails `start()` with an error naming the setting.

    **Migration:** check the `host` in the run config each deployed Node
    worker uses (`RUN_CONFIG`, or `@default` when unset — the case for
    containers). The scaffold template sets `host: 'localhost'` there,
    which now binds loopback only: a container or any Node worker that
    must be reachable from other machines needs `host: '0.0.0.0'` or no
    `host`. A local-only service can now use `host: '127.0.0.1'`.

### Added

- **Node: `BaseWorkerNodeRunner.stop()`** stops accepting connections and
  resolves once the server has closed.

### Fixed

- **RPC: an unregistered service can't shadow a registered procedure.**
  Procedures were looked up by name across every decorated service, first
  import first. A service that was imported but not listed in `services`
  could claim a registered service's procedure name, and calls to it then
  answered `NOT_FOUND`. Lookup now covers only the registered services.
- **Node: `BaseWorkerNodeRunner.start()` rejects when the server can't
  bind.** A port already in use (`EADDRINUSE`) or an address the machine
  doesn't have surfaced as an unhandled `'error'` event while `start()`
  resolved; `start()` now resolves only once the server is listening. The
  startup log prints the address actually bound instead of always
  `127.0.0.1`.

## [1.1.2] - 2026-11-02

### Security

- **RPC: a WebSocket client can no longer call `internal` procedures.** A
  socket event's `origin` is whatever the client sends, and the socket
  dispatch built its RPC request from it — so any client whose upgrade was
  accepted could name an allowed worker and call procedures marked
  `visibility: 'internal'`. On Node, a plain HTTP request with
  `Host: <allowed-worker>.base-internal` did the same. Caller identity
  (`RequestContext.routing`) now comes only from facts a client can't
  forge:
    - Socket-originated RPCs get a new `originType: 'websocket'`, set by
      the server. They reach `@WebSocketRpc()` procedures and `'public'`
      ones, never `'internal'` ones — including when a bound worker
      relays them (relays now identify as the relaying worker, with the
      `base-websocket-fetch` header the target reads).
    - `@WebSocketRpc()` is now enforced at runtime: HTTP callers get
      `NOT_ALLOWED`, and a relayed call must come from a worker on
      `allowedWorkers`.
    - The `.base-internal` hostname is trusted only on Cloudflare.
      `BaseWorkerNodeRunner` now always sets `PLATFORM=Node`.
    - `RpcCall.meta` (a relayed socket's `WebSocketInfo`) is adopted only
      from an allowed relaying worker; a public caller could previously
      claim any socket's identity and context through it.

    **Migration:** a procedure that socket clients call must be marked
    `@WebSocketRpc()` or have `'public'` visibility. Code that switches on
    `routing.originType` should handle `'websocket'`.

- **ORM: an `undefined` condition value no longer widens a write.** The
  where builder treats an `undefined` key as "no condition", so
  `db.delete(Doc, { tenantId: maybeUndefined, status: 'archived' })`
  deleted archived rows for every tenant (the same for `update`,
  `updateBatch`, `deleteBatch`, `writeBatch`'s `deleteWhere`,
  `increment`, and `decrement`). Conditions-based writes now refuse an
  `undefined` anywhere in their conditions — filter operands and relation
  predicates included — with an error naming its path. `deleteBatch` also
  refuses an empty entry, which it previously skipped. Reads are
  unchanged: `undefined` still means "no filter" there, for
  optional-filter building.

    **Migration:** a write that relied on an `undefined` key being skipped
    must omit the key instead.

- **ORM: `OrmRepository.increment`, `decrement`, and `truncate` go through
  the database's guards.** They called the adapter directly, so empty
  conditions returned a silent `{ affectedRows: 0 }`, the entity-ownership
  check was skipped, and `increment`/`decrement` didn't stamp
  update-date columns the way `OrmDatabase.increment` does.

- **CLI: `base deploy` uploads `env.toml` values as Cloudflare secrets.**
  Every merged variable was passed to `wrangler deploy` as
  `--var NAME:VALUE`, so secrets in `env.toml` — where the scaffold tells
  you to put them — became plaintext variables on the deployed worker,
  visible in the Cloudflare dashboard, and appeared in the process
  arguments (`ps`, CI logs) while wrangler ran. Values from the workspace
  and worker `env.toml` now go up through `wrangler deploy --secrets-file`
  from a private temporary file that is deleted afterward;
  `wrangler.toml` `[vars]` and the CLI's provenance stamps stay plain
  vars. `base develop` is unchanged.

    **Migration:** no file changes are needed. Non-sensitive config kept in
    `env.toml` now shows as an encrypted secret; move it to
    `wrangler.toml` `[env.<Name>.vars]` if you want it visible. A name set
    in both `wrangler.toml` `[vars]` and `env.toml` now fails the deploy.
    Secret uploads are additive, so removing a name from `env.toml` no
    longer removes it from the worker — run `wrangler secret delete`.
    Verify the first deploy in a non-production environment.

- **Access control: the most specific declaration wins.** Class, method,
  and base-class `@RequireSessionAccess` / `@WithSessionAccess` options
  merged — `skipAuthorization` ORed and role/entitlement lists
  concatenated — so a class-level `@WithSessionAccess()` silently opened a
  method marked `@RequireSessionAccess()`, and because roles match
  any-of, a method's roles added alternatives to the class's instead of
  narrowing them. Options now resolve field by field from the most
  specific declaration that states the field: method-level over
  class-level, and the handler's own class over its base classes — the
  precedence RPC visibility already uses. A field the method doesn't
  state (e.g. `roles` under a bare `@RequireSessionAccess()`) is still
  inherited, so restating a guard never drops a requirement.

    **Migration:** a method that named its own `roles` or `entitlements` on
    a guarded class now requires those alone; add the class's values to
    the method's list if both should pass. A method `@RequireSessionAccess`
    on a `@WithSessionAccess` class now requires a session.

- **Runtime: `ENVIRONMENT` is required.** A worker started without
  `ENVIRONMENT` silently ran as Development, which turns GraphiQL and
  schema introspection on — so a deploy outside the CLI (a raw
  `wrangler deploy`, a hand-rolled Node runner) served them in
  production. Containers were always affected: the node bootstrap
  defaulted to Development too, so a production container also read its
  `env.toml` `[Development]` section. A missing or blank `ENVIRONMENT`
  now fails at boot, in the runtime and in the node launcher. Every
  `base` CLI command already sets it, so CLI workflows are unchanged.

    **Migration:** set `ENVIRONMENT` wherever a worker starts outside the
    CLI. A container class passes it through `envVars`, e.g.
    `this.envVars = { ENVIRONMENT: env.ENVIRONMENT }` in its constructor.

- **Scaffold: the production deploy ships the commit Integration
  tested.** The generated `deploy-production.yml` runs on `workflow_run`
  but checked out with no `ref`, which on `workflow_run` is the default
  branch's latest commit — possibly newer than, and untested by, the run
  that triggered it. It also set `cancel-in-progress: true`, so a second
  deploy could cancel one halfway through its workers. It now checks out
  `github.event.workflow_run.head_sha` (falling back to `github.sha` for
  manual dispatch) and queues deploys instead of cancelling them.

    **Migration:** existing workspaces keep their generated file. In
    `.github/workflows/deploy-production.yml`, give the `actions/checkout`
    step a `with:` block containing
    `ref: ${{ github.event.workflow_run.head_sha || github.sha }}`, and set
    `cancel-in-progress: false`.

- **RPC: error responses carry stack traces only for bound workers.** An
  RPC failure's `cause` was the handler error's full serializer record —
  its stack trace (internal file paths and line numbers) and, for 4xx
  errors, the unredacted message, including the SQL and bound values of
  a database error — sent to every caller. Public and WebSocket callers
  now get the client-safe shape (`toJSON()`: no stack, database messages
  redacted, as HTTP and GraphQL already did); internal callers (a bound
  worker over a service binding) still get the full record.

- **Queue: concurrent requests no longer duplicate or drop each other's
  messages.** `WorkerQueueService` is worker-scoped, so concurrent events
  in one isolate share its buffer, and each event's post-response drain
  flushes all of it. A drain sent a batch straight from the shared array
  and removed it only after the send resolved, so two overlapping drains
  sent the same messages twice and then removed messages neither had
  sent. Each drain now takes the buffered messages before sending; an
  un-sent remainder is returned to the front of the buffer for the next
  drain.

- **Serialization: a non-object body for a class type is a 400, not a 500.** A JSON primitive (`"abc"`, `5`, `true`) sent where an
  `@HttpBody`/`@RpcArgument` class — or a nested class field — was
  expected reached `fieldName in raw` and threw a `TypeError`: a 500,
  logged and reported as an unhandled exception, that any anonymous
  client could trigger. `deserialize` now answers a primitive, or an
  array where the `TypeFunc` declares one object, with a 400
  `SERIALIZATION_ERROR`.

- **Scheduled: `OrmPersistedScheduledExecutable` rethrows run failures.**
  An error thrown by `run` was logged, recorded as `Failed`, and
  swallowed, so the scheduled run reported success, a Durable Object
  alarm was never retried, and unhandled-exception listeners never
  heard of it — the opposite of what `ScheduledRunner` does for every
  other executable. The error is now recorded and rethrown. A failure to
  write the `Failed` status is logged instead of replacing the original
  error, and a thrown value that can't be JSON-stringified (a BigInt, a
  cycle) no longer breaks the recording. `run` returning `false` is still
  a recorded soft failure that doesn't throw.

## [1.1.1] - 2026-09-14

### Fixed

- **GraphQL: Yoga's own logging goes through the framework `Logger`** under
  the `gql` category, so `LOG_LEVEL` governs it like everything else a worker
  emits. Yoga's error channel is demoted to debug: it fired for every resolver
  error the mask function replaced, so an expected client error (a 404 from a
  lookup, a validation failure) was logged at error level with a stack trace
  on every request. Masked 5xx errors are still logged at error level by
  `gqlMaskError`.

## [1.1.0] - 2026-09-10

### Added

- **ORM: `limit` and `order` on conditions-based `update` and `delete`**
  (`OrmUpdateOptions` / `OrmDeleteOptions`). Bounds a bulk write to a slice
  of the matching rows so retention sweeps and backfills can batch — hosted
  MySQL (PlanetScale) aborts a single statement past 100,000 rows. Works on
  every backend: MySQL natively, SQLite (Durable Objects, D1, better-sqlite3)
  via `SQLITE_ENABLE_UPDATE_DELETE_LIMIT`. A non-positive or non-integer
  `limit` is rejected before reaching the driver.

## [1.0.0] - 2026-08-14

Initial public release. All five packages publish together at 1.0.0:
`@system-inc/base-foundation`, `@system-inc/base-cli`, `@system-inc/base-client`,
`@system-inc/base-common`, and `@system-inc/base-lint`.

### Added

- **Declarative module system** — compose a Cloudflare Worker from decorated
  services, GraphQL resolvers, RPC services, queue processors, scheduled
  tasks, WebSocket delegates, and ORM entities, wired through a scoped
  dependency-injection container.
- **First-class dispatchers** for HTTP, GraphQL (type-graphql + yoga), RPC,
  queues, cron/scheduled tasks, and WebSockets, with one consistent
  validation pipeline across them.
- **Drizzle-backed ORM** — decorator-defined entities, per-worker migration
  ledgers with shared-database ownership checks, mapped joins, filters,
  pagination, and Durable Object SQLite support.
- **The `base` CLI** — scaffold workspaces and workers, develop locally,
  check configuration, run integration tests, manage migrations, generate
  GraphQL schemas, and deploy to Cloudflare.
- **Node as a first-class target** — the same app model runs on Node (minus
  Cloudflare bindings) via a platform delegate.
- Apache-2.0 license, contribution guidelines, code of conduct, and security
  policy.

[Unreleased]: https://github.com/system-inc/base/compare/v1.1.2...HEAD
[1.1.2]: https://github.com/system-inc/base/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/system-inc/base/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/system-inc/base/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/system-inc/base/releases/tag/v1.0.0
