# `@system-inc/base-common`

Pure, environment-agnostic utility helpers shared across the [Base](../../README.md) stack — type helpers, concurrency primitives, crypto, time/date, HTTP and RPC protocol types, currency math, parsing. Written to run unchanged in both Node and Cloudflare Workers. This is the leaf of the dependency graph: it depends on nothing else in the repo.

```bash
npm install @system-inc/base-common
```

Three small runtime deps (`cron-parser`, `decimal.js`, `iso8601-duration`); `graphql` is an optional peer, only needed if you import the `graphql/*` helpers.

## Usage

No barrel files — import the exact module you need (subpath exports):

```ts
import { Backoff } from '@system-inc/base-common/concurrent/Backoff';
import { RpcCall } from '@system-inc/base-common/rpc/protocol/RpcCall';
import { Constructor } from '@system-inc/base-common/type/Constructor';
```

## What's inside

Meatier subsystems: `concurrent/` (async primitives), `type/`, `cryptography/`, `time/`, `http/`, `rpc/protocol/` (the shared RPC wire contract), `graphql/`, `oauth/`. Plus many small util folders (`array/`, `string/`, `number/`, `json/`, `parse/`, …).

See [`CLAUDE.md`](./CLAUDE.md) for the full folder map and design notes.

---

Part of the [Base](../../README.md) monorepo.
