# reference-gen

Generates the **API reference model** for the Base documentation site directly from
this repository's TypeScript source + TSDoc. This is the auto-generation half of the
docs system: it is pure (no CMS, no network, no auth) and version-locked to the commit
it runs against.

```bash
npm run reference:generate                      # extract + transform
npm run reference:generate -- --transform-only  # re-transform the existing extract
```

## Pipeline

1. **Extract** (`generate.mjs`) — runs TypeDoc (programmatic API) over
   `packages/foundation/source` using the `expand` entry-point strategy (base has
   no barrel/index — per-file subpath exports). `internal/` and tests stay in the
   TS program for type resolution but are excluded from the documented surface.
2. **Transform** (`transform.mjs`) — maps the TypeDoc reflection into our own
   `reference-model.json` schema: categorized symbols, fully-typed signatures, TSDoc
   summaries/params/returns/examples, cross-references, and GitHub source permalinks.
   Also emits `tree` — the two-level nav (subsystem → group) described below.
   Also documents re-exports as alias symbols (e.g. `VerifyBy` → `registerRule`) and
   collapses declaration-merged namespaces into their type's symbol as static
   members (e.g. the `WebSocketEvent` guards).
3. **Coverage report** — `coverage-report.md` listing symbols with missing or thin
   TSDoc (no summary, decorators/functions without `@example`, undocumented
   parameters), so gaps can be closed in this repo.

## The nav tree (schema `@2`)

The reference nav is **two levels: subsystem, then group.** A symbol's subsystem
comes from its top-level source folder (`orm/…` → ORM, `router/…` → HTTP); its
group comes from what the symbol is, with decorators first:

```
ORM (256)                     GraphQL (56)
├── Decorators   25           ├── Decorators   14
├── Classes      24           ├── Classes      16
├── Interfaces   76           ├── Interfaces    5
├── Functions    78           ├── Functions    11
├── Types        49           └── …
└── Constants     4
```

Each symbol carries `category` (subsystem) and `group`; the model also emits an
explicit `tree` (`[{ category, count, groups: [{ group, symbols: [id] }] }]`) so the
consumer never re-derives grouping or ordering. Subsystems sort alphabetically,
groups follow the fixed `groupOrder`, symbols sort by name; an empty group is
absent rather than present-and-empty.

> **Breaking change from `@1`.** There is no longer a top-level `Decorators`
> category — its 111 decorators now live under their own subsystem, so everything
> about ORM (or GraphQL, or HTTP) sits in one place. The per-symbol `subcategory`
> field is gone, replaced by `group`. A consumer written against `@1` must be
> updated: read `tree`, or group by `category` + `group`.

## Outputs (`artifacts/`, gitignored)

- `typedoc.foundation.json` — raw TypeDoc reflection (intermediate).
- `reference-model.json` — the consumable model.
- `coverage-report.md` — TSDoc coverage gaps.

`reference-model.json` is the input to the documentation site's sync tooling;
it is regenerated and synced on each release.
