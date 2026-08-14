# @system-inc/base-lint

Shared ESLint configuration and custom rules for Base itself and for projects built on it. Pure ESM, **no build step** — the `.mjs` files are the published artifact. A leaf in the dependency graph (no `base-*` deps).

## Purpose

Bundles the community plugins the repo standardizes on and adds **type-aware custom rules** that enforce contracts the TypeScript compiler can't catch on its own — chiefly that decorator metadata stays in sync with TypeScript types (GraphQL nullability, ORM column nullability, DI inject types, validation optionality) and that architectural boundaries are respected.

## How it's consumed

`main` is `BaseRules.mjs`; it also exposes `./rules/*.mjs`. The root [`eslint.config.mjs`](../../eslint.config.mjs) spreads its three named exports into the flat config:

```js
import {
    baseIgnores,
    baseJavaScriptAndTypeScriptPlugins,
    baseJavaScriptAndTypeScriptRules,
} from '@system-inc/base-lint/BaseRules.mjs';
```

- `baseIgnores` — default ignore globs (build dirs, `.wrangler`, etc.).
- `baseJavaScriptAndTypeScriptPlugins` — plugin registry: `@system-inc/nexus` plugins, `eslint-plugin-unused-imports`, and the custom `base:` namespace rules.
- `baseJavaScriptAndTypeScriptRules` — rule severities (custom rules default to `error`, plus tuned `@typescript-eslint` rules: `no-floating-promises`, `no-misused-promises`, `switch-exhaustiveness-check`, unused-vars handled by `unused-imports` with the `_`-prefix convention).

Consumer projects import `BaseRules.mjs` the same way and may override severities or pass options (e.g. the protected context keys for `context-requires-access`).

## Design choices

- **Type-aware everywhere.** Rules use `@typescript-eslint/utils` and the project service to read inferred types, so they can compare a decorator option (`nullable: true`) against the actual TypeScript type.
- **Decorator/type parity is the theme.** Most rules exist to stop the decorator declaration and the TS type from drifting apart, which would otherwise fail only at runtime.
- **Boundaries enforced at the config layer.** The package dependency DAG (`cli → foundation → client → common`; `common`/`lint` leaves) is enforced via `eslint-plugin-boundaries`, wired up in the root `eslint.config.mjs` package element definitions. Import sorting (`@ianvs/prettier-plugin-sort-imports`) and boundaries were enabled together (commit `7c2970b`).
- **Public-vs-`internal/` folder boundary** is enforced by `nexus/no-internal-imports-rule` (re-exported from `@system-inc/nexus` and enabled in `baseJavaScriptAndTypeScriptRules`) — this is what stops code from importing another subsystem's `internal/` machinery. (Distinct from `base/no-base-project-imports`, which is the `@project`-alias boundary below.)

## Rules (`rules/`)

| Rule file                                  | Enforces                                                                                                                                                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GqlNullableParityRule.mjs`                | `@Gql*` nullability matches the TS type (unwraps `Promise<T>`)                                                                                                                                       |
| `GqlOperationContextMatchesReturnRule.mjs` | `@InjectGqlOperationContext<T>` generic matches the resolver's return type                                                                                                                           |
| `OrmColumnNullableParityRule.mjs`          | `nullable: true` columns include `null`/`undefined` in their TS type                                                                                                                                 |
| `OrmColumnRequiresDeclareRule.mjs`         | ORM column properties use `declare` (so emitted class fields don't overwrite the tracking-entity accessors — see the [orm doc](../foundation/source/orm/CLAUDE.md))                                  |
| `RelationMustBeOptionalRule.mjs`           | Relation properties include `undefined` (not eagerly hydrated)                                                                                                                                       |
| `RequireSpdxHeaderRule.mjs`                | File starts with the SPDX license header (auto-fixable). Registered but not in the shared severities — a base-repo licensing policy, enabled in its root eslint config, never inherited by consumers |
| `SerializableNullableParityRule.mjs`       | `@SerializableField optional` matches the TS type                                                                                                                                                    |
| `VerifyOptionalParityRule.mjs`             | `@VerifyIsOptional()` presence agrees with type optionality                                                                                                                                          |
| `VerifyArrayParityRule.mjs`                | an array-typed property carrying value-level `@Verify*` rules also declares an array-level rule (`@VerifyIsArray`, …), so the value rules validate each element                                      |
| `InjectTypeMatchesParameterRule.mjs`       | Typed inject decorators resolve to the parameter's type                                                                                                                                              |
| `ProviderReturnMatchesTokenRule.mjs`       | Provider method return type matches the token's expected type                                                                                                                                        |
| `ContextRequiresAccessRule.mjs`            | Methods injecting a protected context key carry a matching access decorator (configurable)                                                                                                           |
| `PaginationDecoratorRule.mjs`              | `PaginationInput` args are named `pagination` or `*Pagination`                                                                                                                                       |
| `NoBaseProjectImportsRule.mjs`             | Framework code can't import from the `@project` alias (the framework-vs-consumer-project boundary; **not** the foundation `internal/` boundary — that's `nexus/no-internal-imports-rule`)            |
| `_decoratorHelpers.mjs`                    | Shared helpers (`isNullableType`, `typeIncludesUndefined`, relation-decorator set, option readers)                                                                                                   |

## Relationship to other packages

Consumed by the root `eslint.config.mjs` (and by downstream consumer projects). Has no dependency on other `base-*` packages; instead it _describes and enforces_ their boundaries.
