# `@system-inc/base-foundation`

The core [Base](../../README.md) framework. Build a Cloudflare Worker as a set of declarative **modules**: define services, GraphQL resolvers, queue processors, scheduled tasks, RPC services, and ORM entities with decorators, and the framework wires them through a dependency-injection container and dispatches platform events (HTTP, queue, cron, WebSocket, RPC) to your code. The same app model also runs under Node.

```bash
npm install @system-inc/base-foundation
```

### Peer dependencies

Foundation keeps the heavy libraries as **peer** dependencies so a worker only pulls in what it uses. Install the peers your features need — e.g. `tsyringe` + `reflect-metadata` (DI, always), `itty-router` (routing), `@system-inc/type-graphql` + `graphql` + `graphql-yoga` (GraphQL — the scoped fork, not upstream `type-graphql`), `drizzle-orm` (ORM), `@cloudflare/containers` (Durable Objects). See `peerDependencies` in `package.json`.

## Usage

No barrel files — import the exact module:

```ts
import { BaseModule } from '@system-inc/base-foundation/module/BaseModule';
import { BaseWorker } from '@system-inc/base-foundation/worker/BaseWorker';

// settings.ts describes the worker: name/version, modules, and per-subsystem settings
export default {
    name: 'my-worker',
    title: 'My Worker',
    version: '1.0.0',
    modules: [
        /* ... */
    ],
};
```

Workers are normally scaffolded, built, run, and deployed with the [`base` CLI](../cli/README.md) (`npx base develop`, `deploy`, `orm`, …).

## Architecture

[`CLAUDE.md`](./CLAUDE.md) is the architecture map — the subsystem layout, the public-folder vs `internal/` convention, the DI scopes, the two ORM paths, and a per-subsystem doc for each major folder (`base/`, `orm/`, `graphql/`, `rpc/`, `router/`, `queue/`, …).

---

Part of the [Base](../../README.md) monorepo.
