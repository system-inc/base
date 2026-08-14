---
title: Settings and Dependencies
description: What a module can register, and how modules declare they need each other.
identifier: settings-and-uses
---

## The settings surface

A module's `settings` has exactly seven framework slots — everything else is your module-specific configuration merged in through the key's generic:

| Slot            | Registers                                                                         |
| --------------- | --------------------------------------------------------------------------------- |
| `services`      | **the** class list — dispatch classes, provider hosts, injectables                |
| `orm`           | `entities` (owned tables), `externalEntities` (query-only tables), `databaseName` |
| `middleware`    | `global` (every request) and `handler` (post-routing) middleware                  |
| `accessControl` | the session context provider — a worker's identity seam                           |
| `graphql`       | schema `directives`                                                               |
| `webSocket`     | socket `delegates` and context `mappings`                                         |
| `cli`           | `configValidators` run by `base check`                                            |

Notice what's _not_ here: no `graphql.resolvers`, no `router.services`, no `rpc.procedures`. A class's dispatch decorator already declares its role — a per-kind slot could only agree with it or contradict it, so those slots don't exist. `services` states existence; decorators state role.

The surviving slots all carry information that is **not** a property of a class: cross-class ordering (middleware), instance configuration (socket paths), per-registration relationships (owned vs external entities), or non-class values (directives, validators).

## Declaring dependencies: `uses`

When your module needs another module present (its services, its middleware, its wiring) declare it:

```ts
export function Notes(): BaseModule<unknown> {
    return BaseModule.create({
        key: NotesModuleKey,
        uses: [AccountModuleKey],
        settings: { ... },
    });
}
```

- Reference the other module's **key**, not its factory: keys are lightweight identity objects, so `uses` never creates import cycles between module packages. Shared registries of keys (a `BaseModuleKeys` class) are the convention at scale.
- `uses` order drives **middleware execution order** and **initialization order** across modules.
- The worker still registers the used module itself: `uses` declares the requirement; it doesn't auto-register.

### Feature-scoped dependencies

A dependency can apply only while a feature of _your_ module is enabled:

```ts
    uses: [
        AccountModuleKey,                              // always required
        { module: ImageModuleKey, when: 'graphql' },   // only while graphql is on
    ],
```

If a worker registers your module with `.with({ graphql: false })`, the `when: 'graphql'` dependency is dropped along with the feature, so stripped-down registrations don't drag in companions they no longer need. The `when` values are the feature toggles: `orm`, `eventBus`, `graphql`, `queue`, `router`, `rpc`, `scheduled`, `middleware`, `webSocket`.

## Entities across modules: `externalEntities`

`orm.entities` means _this module owns these tables_ (it migrates them). When a module only needs to **query** tables owned elsewhere, it lists them as `externalEntities` — they join the query schema but never migration scope. This is a _table_ dependency, deliberately separate from `uses` (a _module_ dependency): you can query another worker's tables without needing its services, and vice versa. The registration side of this story is [`externalSchema`](./03-registration-modifiers.md#externalschema-query-only-tables).
