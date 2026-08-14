# validation/ — decorator-driven validation

Validates input objects against rules attached with `@Verify*` decorators. The framework runs it automatically at every input boundary — HTTP bodies, RPC parameters, and GraphQL arguments — so a typed input class with `@Verify*` decorators is validated before your handler sees it. 32 rule decorators (31 rules + `VerifyBy`) + the engine; this is the one folder-level doc for the subsystem.

## How it's consumed

Decorate a class; the framework validates instances of it at the boundary:

```ts
export class CreateAccountInput {
    @VerifyIsEmail() email: string;
    @VerifyIsOptional() @VerifyMaxLength(80) name?: string;
    @VerifyArrayMinSize(1) roles: string[];
}
```

You rarely call the engine yourself — but `await validate(value)` (`ValidationEngine.ts`) is the entry point — async, resolving to a **flat** `ValidationError[]` (empty = passed). Each error has `{ path, value, constraints }` (`value` is stripped before the error goes on the wire) where `path` is a dotted/bracketed location (`"address.postalCode"`, `"items[2].sku"`) and `constraints` maps failed-rule-name → message.

## Where it runs (call sites)

`validate()` is invoked on the typed/deserialized input at three boundaries — search these if you're tracing where a `ValidationError` came from:

| Boundary          | Call site                       |
| ----------------- | ------------------------------- |
| HTTP request body | `internal/router/BaseRouter.ts` |
| RPC parameters    | `internal/rpc/RpcDispatcher.ts` |
| GraphQL arguments | `graphql/GqlBuildSchema.ts`     |

## How the engine works (`ValidationEngine.ts`)

`validate(value)` walks the object graph:

- **Deep by default.** Any property holding a class instance that has registered rules is validated recursively — and even rule-less intermediate objects are traversed in case they contain a deeply-nested validatable child. Callers never annotate nested types.
- **Arrays are declared, then value rules iterate.** A property holding an array must carry an _array-level_ rule (`@VerifyIsArray`, `@VerifyArrayMinSize`, …). When one is present, _value-level_ rules apply to each element (error path includes the index, `items[2].email`) and the array-level rule receives the whole array. Without an array-level rule a value-level rule evaluates the value itself — so an array sent for a scalar property is **rejected**, not silently iterated (an empty array would otherwise run zero checks and bypass every rule). The `verify-array-parity` lint rule flags an array-typed property whose value rules lack an array-level rule.
- **`@VerifyIsOptional()` short-circuits.** If the property value is `null`/`undefined`, all other rules on that property are skipped. (Tracked by the sentinel rule name `IsOptional` so the engine isn't coupled to the decorator module.)
- **Cycle-safe.** A `WeakSet` of visited objects prevents infinite recursion through self-referential graphs.
- **Inheritance.** Rule metadata is keyed by constructor and the engine walks the prototype chain, so subclasses inherit their parents' rules.

## How rules are defined (`RegisterRule.ts`)

Every `@Verify*` decorator is produced by `registerRule(definition)`. A `RuleDefinition` has:

- `name` — surfaced in `ValidationError.constraints` (conventionally the decorator name minus `Verify`, e.g. `VerifyMaxLength` → `"MaxLength"`).
- `operatesOn?: 'value' | 'array'` — value-level (default; applies per-element when the property also has an array-level rule) vs array-level.
- `check(value, options, context) => RuleCheckResult` — return `true` to pass, `false` for the default message, or a `string` for a custom message.
- `defaultMessage` — string (with `$property` interpolation) or a function of the `ValidationContext`.

`registerRule` returns a decorator factory and also exposes a `.check(value)` predicate for ad-hoc use (in services or tests) outside a decorator context; only a literal `true` counts as a pass.

**Custom rules:** `VerifyBy` is simply `registerRule` re-exported — author a project-specific rule with it.

Rule metadata is stored per-class in `internal/metadata/ValidationMetadata.ts` (`RuleMetadata`), reachable via `getBaseMetadata().validation`. `ValidationContext` (defined there) carries `target`, `property`, `value`, and the rule options.

## Built-in rules (`decorators/`)

Value-level (one per file): type checks (`VerifyIsString`/`IsNumber`/`IsInt`/`IsBoolean`/`IsDate`/`IsObject`/`IsArray`/`IsEnum`), presence (`VerifyIsDefined`/`IsOptional`), strings/formats (`VerifyIsEmail`/`IsUrl`/`IsUUID`/`IsIP`/`IsDomain`/`IsPhoneNumber`/`StringMatches`), i18n (`VerifyIsCountryCode`/`IsLocale`/`IsTimeZone`, backed by `decorators/internal/Iso3166Codes`), numeric/length/date bounds (`VerifyMin`/`Max`/`Length`/`MinLength`/`MaxLength`/`MinDate`/`MaxDate`), and `VerifyBy` (custom).

Array-level (`operatesOn: 'array'`): `VerifyArrayMinSize`, `VerifyArrayMaxSize`, `VerifyArrayUnique`, `VerifyIsArray`, and `VerifyIsNotEmpty` (emptiness is a property of the container — on an array field it checks the array itself, so an empty array fails).

## Design notes

- **Optionality parity is lint-enforced.** `base-lint`'s `verify-optional-parity` rule checks that `@VerifyIsOptional()` presence agrees with the TypeScript type's optionality — so a nullable field carrying `@Verify*` rules must also carry `@VerifyIsOptional()`.
- **Errors are data, not exceptions.** `validate()` returns a flat array; the calling boundary decides how to surface it (the dispatchers turn a non-empty result into the framework's argument-validation error). This keeps the engine reusable and testable.
