# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/system-inc/base/compare/v1.1.1...HEAD
[1.1.1]: https://github.com/system-inc/base/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/system-inc/base/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/system-inc/base/releases/tag/v1.0.0
