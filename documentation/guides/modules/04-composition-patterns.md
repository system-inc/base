---
title: Composition Patterns
description: Core/client splits, shared databases, and the four axes of multi-worker module design.
---

Real systems run several workers over shared functionality: an API worker, a background worker, maybe a Durable Object — each needing a different slice of the same feature. Base's module system handles this with a handful of composable patterns, all used throughout System, Inc.'s companion module library.

## The core/client split

Split a feature into two modules along the code-shipping boundary:

- **Core** — entities and internal logic, no public API surface. Safe anywhere: background workers, queue consumers, Durable Objects.
- **Client**: the API surface (resolvers, HTTP/RPC services), which `uses` the core.

```ts
export function NotesCore(): BaseModule<unknown> {
    return BaseModule.create({
        key: NotesCoreModuleKey,
        settings: {
            orm: { entities: [NoteEntity] },
        },
    });
}

export function NotesClient(): BaseModule<unknown> {
    return BaseModule.create({
        key: NotesClientModuleKey,
        settings: {
            services: [NoteResolver, NoteHttpService, NoteRpcService],
        },
        uses: [NotesCoreModuleKey],
    });
}
```

The API worker registers **both**; the background worker registers only core:

```ts
// api worker
    modules: [NotesCore(), NotesClient()],

// background worker
    modules: [NotesCore()],
```

Why not just `NotesClient().with({ graphql: false, router: false, rpc: false })`? Because [toggles strip wiring, not code](./03-registration-modifiers.md#feature-toggles) — the resolvers would still ship in the background worker's bundle. The split is how code actually stays out. This is a convention, not a framework primitive: there's no `core:` field, just two modules and a `uses` edge.

## Shared databases: who owns the schema

When two workers share a database, exactly one of them owns each module's tables:

```ts
// api worker — owns and migrates
    modules: [NotesCore(), NotesClient()],

// background worker — same tables, query-only
    modules: [NotesCore().with({ externalSchema: true })],
```

The owner runs [migrations](../orm/03-migrations.md); the other worker's schema commands ignore those tables entirely. No double-migration, no drift, and the ownership decision is visible in one line of settings.

## The four axes

Every multi-worker composition question resolves to one of four independent decisions:

| Axis       | Mechanism                                   | Decides                                                      |
| ---------- | ------------------------------------------- | ------------------------------------------------------------ |
| Code       | core/client module split                    | which **code ships** in each worker                          |
| Schema     | `.with({ externalSchema })`                 | which worker **migrates** the tables                         |
| Connection | `.with({ database })` + declared membership | which **database** entities and injections resolve to        |
| Ordering   | `uses` (feature-scoped with `when`)         | **initialization and middleware order**, required companions |

They compose freely — a worker can register a core-only module, schema-external, routed to a named database, with feature-scoped dependencies dropped. Each decision is one visible line in `settings.ts`, which is the point: composition is configuration, reviewed in the same PR as everything else.
