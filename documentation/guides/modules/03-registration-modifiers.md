---
title: Registration Modifiers
description: Adapt a module per worker with .with() to strip features, redirect databases, and disclaim schema ownership.
---

The same module rarely runs identically in every worker. Registration modifiers adapt a module **at the registration site**. The module's code stays untouched; the worker composing it decides:

```ts
    modules: [
        Notes().with({ graphql: false }),
        Account().with({ externalSchema: true, database: 'accounts' }),
    ],
```

`.with()` calls merge, so modifiers can be layered.

## Feature toggles

Nine boolean switches: `orm`, `eventBus`, `graphql`, `queue`, `router`, `rpc`, `scheduled`, `middleware`, `webSocket`. Each strips that feature's wiring _for this registration_:

- `queue: false`: the module's queue processors aren't registered, so the worker passes `base check` without queue consumers in its wrangler config.
- `graphql: false`: the module's resolvers stay out of the schema.
- `middleware: false`: worth knowing specifically, because a module's global middleware otherwise runs on **every** request of the host worker.

Two semantics to internalize:

- **Toggles control wiring, not the bundle.** Stripped code is still imported and shipped; only its registration is skipped. If you need the code itself gone (bundle size, isolation), register a smaller module instead; see [Composition Patterns](./04-composition-patterns.md).
- Toggles cascade into dependencies: a [`{ module, when }` entry](./02-settings-and-dependencies.md#feature-scoped-dependencies) naming a stripped feature is dropped with it.

## `externalSchema`: Query-only tables

```ts
    modules: [Account().with({ externalSchema: true })],
```

Registers the module's entities for **queries** but disclaims schema ownership: they're excluded from migration generation and schema sync in this worker. Use it when two workers share a database and the _other_ one owns the tables: the owning worker registers the module normally and migrates, while this worker only reads and writes data.

The one-owner rule is enforced: `check --all-workers` (and every workspace deploy) compares ownership claims across workers by physical database identity (D1 `database_id`, PlanetScale host + database) and **fails** when two workers both claim the same table, since two owners means two migration histories writing DDL for one table. The fix it points to is this modifier (or `externalEntities`).

## `database`: Route the module elsewhere

```ts
    modules: [Notes().with({ database: 'content' })],
```

Routes the module to a named database **in this worker** (overriding the module's own `orm.databaseName`). It governs both where the module's entities register _and_ where token-less `@InjectRepository`/`@InjectDatabase` in the module's declared member classes resolve, provided those classes [declare their membership](../dependency-injection/01-inject-services.md#module-membership-the-modulekey-argument) with `@Injectable(NotesModuleKey)`. Boot validation enforces the declaration: a non-default-database module's class that injects token-lessly without declaring is rejected at startup, not discovered in production.

Commonly paired with `externalSchema: true`: _this module's data lives in that other database, which somebody else migrates._

## The composition mindset

A module states what it _is_; registrations state how each worker _uses_ it. One `Notes` module can be, simultaneously: full-featured in the API worker, GraphQL-less in a webhook worker, and schema-external in a background worker sharing the database. That's the reuse story: one module, per-worker adaptation, no forks.
