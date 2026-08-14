# Base

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.12-brightgreen.svg)](https://nodejs.org)

**A modular framework for building Cloudflare Worker–based applications.**

`base` lets you build a Cloudflare Worker as a set of declarative **modules**. You define services, GraphQL resolvers, queue processors, scheduled tasks, RPC services, and ORM entities with **decorators**; the framework wires them together through a **dependency-injection container** and dispatches platform events — HTTP requests, queue messages, cron triggers, WebSocket events — to your code. Through a platform-delegate abstraction, the same app model also runs on **Node** (minus Cloudflare-specific bindings), which is how the test suite runs.

## How it fits together

You write a class, decorate it, register it in a module, and add the module to a worker:

```
decorated class                  module                       worker
@OrmTable / @HttpService /       BaseModule.create({          BaseSettings.modules: [
@GqlResolver / @RpcService / ──►   settings: {          ──►     AccountModule,
@WorkerQueueProcessor /              orm.entities,              BillingModule, …
@ScheduledExecutable /               graphql.resolvers,       ]
@EventBusListener                    router.services,
                                     rpc.procedures, … } })
```

At runtime, `BaseWorker.create(settings)` exports the standard Cloudflare Worker shape (`fetch` / `queue` / `scheduled`). The first event boots a DI container, flattens your modules into an application manifest, validates that every registered class carries its decorator, and binds your routes. Each subsequent event runs in a fresh scoped child container that resolves the handler, runs middleware, validates input, and returns a `Response`.

## Features

- **Declarative modules** — compose an app from decorated services, resolvers, processors, and entities.
- **Dependency injection** — a scope hierarchy (`@global → @worker → {@request | @queue | @scheduled | @websocket}`) with `@Singleton` / `@WorkerScoped` / `@ContainerScoped` lifetimes.
- **GraphQL, RPC, HTTP, queues, scheduled tasks, WebSockets** — first-class dispatchers for each, with one consistent validation path.
- **ORM** — decorator-defined entities backed by Drizzle, with CLI-driven migrations.
- **Runs on Cloudflare or Node** — a platform delegate makes the identical app model target both.
- **A CLI** (`base`) to scaffold, build, run, test, and deploy workers.

## Packages

This is an npm workspaces monorepo.

| Package                                                          | Description                                                                      |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [`@system-inc/base-foundation`](./packages/foundation/README.md) | Core framework: DI, modules, routing, ORM, GraphQL, queue, scheduled, validation |
| [`@system-inc/base-cli`](./packages/cli/README.md)               | The `base` CLI for building, running, and deploying workers                      |
| [`@system-inc/base-client`](./packages/client/README.md)         | RPC and HTTP-error client for browsers and workers                               |
| [`@system-inc/base-common`](./packages/common/README.md)         | Pure, environment-agnostic utility helpers                                       |
| [`@system-inc/base-lint`](./packages/lint/README.md)             | Shared ESLint config and custom rules                                            |

The [`examples/`](./examples/README.md) workspace holds runnable example workers that double as integration-test fixtures.

## Getting started

> **Requires Node.js >= 22.12.** Local development needs no Cloudflare account; deploying does.

Scaffold a workspace with a starter worker and run it:

```bash
npx @system-inc/base-cli workspace create my-app
cd my-app
git init && npm run prepare        # wires up the pre-commit format hook
npm run base -- develop -w app     # local dev server (wrangler dev)
```

A worker is a directory under `workers/` containing a `settings.ts` that exports a `BaseSettings` — the single source of truth shared by the CLI and the runtime. The starter worker comes with a working HTTP service to build from:

```ts
@Injectable()
@HttpService()
export class HelloWorldService {
    constructor(
        @Inject(GreetingService)
        private readonly greetingService: GreetingService,
    ) {}

    @HttpRoute('GET', '/')
    helloWorld(): Response {
        return new Response(this.greetingService.greet());
    }
}
```

Grow the app by adding modules to the worker's `BaseSettings.modules`, and deploy when ready:

```bash
npm run base -- deploy -w app --environment Production
```

Adding Base to an existing project instead? Install the packages directly — every module is a per-file subpath import, no barrel:

```bash
npm install @system-inc/base-foundation @system-inc/base-common @system-inc/base-client
npm install -D @system-inc/base-cli @system-inc/base-lint
```

## Documentation

- **[Getting started](./documentation/getting-started/)** — a six-part tutorial from scaffold to deployed worker with a database, GraphQL, and RPC.
- **[Guides](./documentation/guides/)** — ~50 focused guides covering modules, the ORM, GraphQL, the CLI, security, and multi-worker composition; start at the [documentation index](./documentation/README.md).
- **[CLI command reference](./documentation/guides/cli/03-command-reference.md)** — the full command set (`develop`, `test`, `deploy`, `bundle`, `orm`, `graphql`, `workspace`, …).
- **[`examples/`](./examples/README.md)** — complete, runnable workers that double as integration-test fixtures.

## Contributing

Contributions are welcome! Please read the [Contributing Guide](./CONTRIBUTING.md) — it covers repo setup, the development workflow, running the example workers, and the conventions PRs are held to — along with our [Code of Conduct](./CODE_OF_CONDUCT.md). To report a security issue, see the [Security Policy](./SECURITY.md).

## License

Licensed under the [Apache License 2.0](./LICENSE). Copyright © 2026 System, Inc.
