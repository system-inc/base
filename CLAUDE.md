# Base

Modular framework for building **Cloudflare Worker**–based applications. This file orients you to the whole monorepo; each package and each major subsystem has its own `CLAUDE.md` that goes deeper. Read this first, then drill into the package you're working in.

## What this is

`base` lets you build a Cloudflare Worker as a set of declarative **modules**. You define services, GraphQL resolvers, queue processors, scheduled tasks, RPC services, and ORM entities using **decorators**; the framework wires them together through a **dependency-injection container** and dispatches platform events (HTTP requests, queue messages, cron triggers, WebSocket events) to your code. Via a platform-delegate abstraction the same app model also targets **Node** — a first-class deployment target for complete Node-based workers (and what tests run on), minus Cloudflare-specific bindings.

## How a base app fits together

**Build model — declare, then register (registration is explicit, never magic).** You write a class, decorate it with what it _is_, list it once in `services`, and add the module to a worker's `BaseSettings.modules`:

```
decorated class                          module                          worker
@OrmTable ──────────────────────►  BaseModule.create({             BaseSettings.modules: [
@HttpService / @GqlResolver /         settings: {              ──►      AccountModule,
@RpcService / @WorkerQueueProcessor /   orm.entities,                   BillingModule, …
@ScheduledExecutable /          ──►     services, … } })            ]
@EventBusListener / @Injectable
```

The decorator `mark`s the class in a `DecoratorRegistry`; at boot the manifest sorts each `services` class into its dispatch surface(s) by those marks — the decorator is the single statement of a class's role, and `services` states only that it exists here. A listed class with no recognized decorator is a boot error (it could do nothing, so listing it is a mistake). Entities register under `orm.entities`; configuration-carrying registrations (webSocket delegates, middleware, GraphQL directives, the access-control provider) keep their own settings slots.

**Runtime lifecycle:**

```
BaseWorker.create(settings)      exports fetch / queue / scheduled (the Cloudflare Worker shape)
  └─ first event ─► Base.initialize()              (idempotent)
        • build the @worker DI container
        • flatten all modules (+ their `uses` deps) into a BaseAppManifest
        • validate every registered class carries its decorator
        • bind GraphQL / RPC / WebSocket / HTTP routes
  └─ each event ─► a fresh scoped child container   (@request | @queue | @scheduled | @websocket)
        • the dispatcher resolves the handler from DI
        • runs middleware, deserializes + validates the input
        • invokes the handler ─► Response
        • deferred work (queue drain, etc.) runs in executionContext.waitUntil, then the container disposes
```

DI is a scope hierarchy `@global → @worker → {@request | @queue | @scheduled | @websocket}`; classes opt into a lifetime with `@Singleton` / `@WorkerScoped()` / `@ContainerScoped()`. Validation runs the same way (`validate()`) across HTTP, RPC, and GraphQL. A platform delegate makes the identical flow run on Cloudflare or Node.

**Read in this order for the full mental model:**

1. [foundation `CLAUDE.md`](./packages/foundation/CLAUDE.md) — the design patterns + subsystem map.
2. [`module/`](./packages/foundation/source/module/CLAUDE.md) — how you register everything (`ModuleSettings`).
3. [`base/`](./packages/foundation/source/base/CLAUDE.md) — boot + dispatch lifecycle.
4. [`configuration/`](./packages/foundation/source/configuration/CLAUDE.md) — `BaseConfiguration`, the manifest, decorator validation.
5. [`dependency-injection/`](./packages/foundation/source/dependency-injection/CLAUDE.md) — scopes, inject decorators, typed tokens.
6. Then the subsystem you're touching — [orm](./packages/foundation/source/orm/CLAUDE.md), [graphql](./packages/foundation/source/graphql/CLAUDE.md), [rpc](./packages/foundation/source/rpc/CLAUDE.md), [router/http](./packages/foundation/source/router/CLAUDE.md), [queue](./packages/foundation/source/queue/CLAUDE.md), [scheduled](./packages/foundation/source/scheduled/CLAUDE.md), [web-socket](./packages/foundation/source/web-socket/CLAUDE.md), [access-control](./packages/foundation/source/access-control/CLAUDE.md), …

## Repository layout

npm **workspaces** monorepo (`packages/*` + `examples`).

| Package                                                  | npm name                      | Role                                                                                               |
| -------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------- |
| [`packages/lint`](./packages/lint/CLAUDE.md)             | `@system-inc/base-lint`       | Shared ESLint config + custom rules (ESM, no build step)                                           |
| [`packages/common`](./packages/common/CLAUDE.md)         | `@system-inc/base-common`     | Pure, environment-agnostic utility helpers                                                         |
| [`packages/client`](./packages/client/CLAUDE.md)         | `@system-inc/base-client`     | RPC + HTTP-error client for browsers / workers                                                     |
| [`packages/foundation`](./packages/foundation/CLAUDE.md) | `@system-inc/base-foundation` | The core framework (DI, modules, routing, ORM, GraphQL, queue, scheduled, RPC, web-socket)         |
| [`packages/cli`](./packages/cli/CLAUDE.md)               | `@system-inc/base-cli`        | CLI (`base`) to scaffold, build, run, and deploy workers                                           |
| `examples/`                                              | —                             | Real workers used as integration fixtures (`base-durable`, `test-worker`, queue producer/consumer) |

## Dependency graph (enforced by lint)

```
        common  ◄──── client ◄──── foundation ◄──── cli
          ▲                            ▲              │
          └────────────────────────────┴─────────────┘
        lint (leaf, no base deps)
```

- `common` and `lint` are leaves — they import nothing else in the repo.
- `client` → `common` only.
- `foundation` → `client` + `common`.
- `cli` → `foundation` + `client` + `common`.

`eslint-plugin-boundaries` (configured in [`eslint.config.mjs`](./eslint.config.mjs) via `@system-inc/base-lint`) enforces this DAG. Don't introduce edges that violate it.

## Conventions that apply everywhere

- **No barrel files.** There is no `index.ts` re-exporting a package. Every package ships per-file subpath exports (`"exports": { "./*": ... }`), and you import the exact file: `import { Constructor } from '@system-inc/base-common/type/Constructor'`. Add new public code as a new file, not as an entry in a barrel.
- **Public folder + `internal/` split.** In `foundation` especially, a feature has a public folder holding the types/decorators/settings consumers use (e.g. `queue/`, `router/`, `graphql/`), and a sibling under `internal/` holding the dispatcher/runtime machinery (e.g. `internal/queue/`, `internal/router/`, `internal/graphql/`). The `nexus/no-internal-imports-rule` lint rule (from `@system-inc/nexus`, enabled via `base-lint`) keeps the boundary clean. Consumer code never imports from `internal/`.
- **Decorators + `reflect-metadata`.** Application surface (routes, resolvers, entities, injections) is declared with decorators; a `DecoratorRegistry` (from `common`) collects decorated classes so the framework can validate and wire them at boot.
- **Naming: name types for the concept, not the construct.** No `I` prefix on interfaces (the `interface` keyword already says it's one) and no `*Interface`/`*Type` suffix for its own sake — `PaginationInput`, not `IPaginationInput`. Prefix framework-internal types with their subsystem (`Gql*`, `Orm*`, `Base*`); keep schema/wire-facing types clean (`RpcCall`, `PaginationInput`). Qualify a name _only_ to resolve a genuine collision — e.g. `WorkerQueueProcessorInterface` exists because the clean noun is taken by the `@WorkerQueueProcessor` decorator.
- **JSDoc is always block-form.** Even a one-sentence doc comment gets the multi-line shape — `/**`, ` * <text>`, ` */` on their own lines — never a single-line `/** ... */`.
- **Source lives in `source/`, builds to `dist/`.** TypeScript project references; `dist/` is generated, never edited.

## Commands

```bash
npm install
npm run typecheck  # tsc across all packages (+ the worker-purity check)
npm run build      # bundle the CLI (esbuild) — the libraries ship source, so this is CLI-only
npm run dev        # tsc --watch
npm run test       # jest (unit)
npm run lint       # eslint .
npm run format     # prettier (with import sorting)
npm run base -- <cmd>   # run the CLI from source build, e.g. `npm run base -- check --all-workers`
npm run test:integration   # base test --all-workers
npm run ci         # clean + typecheck + build + lint + format:check + test + check all workers
```

Node >= 22.12 is required.

## Working in this repo

Approach every change as an **owner** of this codebase, not a visitor passing through.

**This is the framework — judge capability on principle, not local usage.** The `examples/` workers are fixtures, not real consumers; the actual consumers are downstream applications built on the published packages. So never decide a framework feature's fate by whether anything in this repo calls it. A capability here — a method, an option, dialect parity, anything a predecessor already supported — is preserved and completed because real consumers depend on it, even with zero callers in this repo. "Nothing uses it" is never grounds to drop, stub, throw on, or downgrade a framework feature; a capability that regresses below its predecessor or sits as an unimplemented stub is a bug to fix, not an acceptable gap.

**Ownership**

- Leave the code better than you found it, never worse. Match the surrounding style; don't leave dead code, commented-out blocks, or context-free TODOs behind.
- Finish the whole change. If you rename or move something, update _every_ reference, fix the docs that mention it, and remove stale artifacts — a half-applied change is a bug handed to the next person.
- Keep `CLAUDE.md` files true. After changing code in a folder that has a `CLAUDE.md` (or is covered by one in a parent folder), re-read it and check that what it says still matches the code — names, paths, behavior, examples. If your change made any of it stale, update the doc in the same change.
- Verify before you call it done: `npm run typecheck`, `npm run build`, and `npm run lint` must pass, and relevant tests must run. If something fails or you skipped a step, say so plainly — never report success you didn't earn.
- Fix root causes, not symptoms. When a test fails, decide whether the test or the implementation is wrong instead of papering over it.

**Code quality**

- Idiomatic over clever. New code should read like the code around it and follow the conventions above and the per-area `CLAUDE.md` files.
- **DRY — don't copy-paste logic.** If the same non-trivial logic shows up in two places, extract it into a shared helper rather than duplicating it (e.g. platform resolution lives in `CliPlatformType.resolvePlatform`, shared by `develop` and `bundle`). Put the helper where both callers can reach it without violating the dependency graph; one source of truth means one place to fix a bug.
- Lean on the type system and the `base-lint` rules — they encode real invariants (decorator/type parity, boundaries). Don't fight a rule; understand why it exists first.
- Add dependencies reluctantly. Prefer the helpers in `base-common` and a little of your own code over pulling in a library.
- Question unclear requirements and surface tradeoffs rather than guessing.

**Testing**

- Write practical tests that exercise real behavior and edge cases. Don't test what the type system already guarantees, or trivial pass-through logic — that's noise.
- Use realistic inputs and real logic; mock only at genuine boundaries, and keep mocks grounded in how the dependency actually behaves.
- Unit tests live next to the code (`*.test.ts`) and run under `npm test` (jest); integration tests live in a worker's `test/` folder as `*.integration.test.ts` and run via `base test` against a live worker.
- Run unit tests with `npm test` (jest). Run a worker's integration tests with `npm run base -- test -w <worker>`, or `npm run test:integration` for all workers.

## Documentation system

The official docs site is generated in part from this repo. Hand-written guides
live in **`documentation/`** (markdown, co-located with the code they document;
synced to the docs site on merge). **`scripts/reference-gen/`**
(`npm run reference:generate`) runs TypeDoc over `foundation` and produces the
API reference model the docs site consumes — see `scripts/reference-gen/README.md`
for the pipeline and output schema. When you change public API or move files,
keep the affected `documentation/` pages true in the same change.
