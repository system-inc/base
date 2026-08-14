# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/system-inc/base/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/system-inc/base/releases/tag/v1.0.0
