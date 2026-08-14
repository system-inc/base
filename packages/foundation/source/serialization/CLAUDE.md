# serialization/ — explicit JSON (de)serialization

Decorator-driven, **opt-in** serialization for classes — distinct from `JSON.stringify`. Only fields marked `@SerializableField` cross the wire, with control over field naming, optionality, defaults, custom transforms, and cycle handling. Used wherever the framework moves typed objects in/out of JSON (notably the [RPC dispatcher](../rpc/CLAUDE.md)).

## Decorating

```ts
@SerializableObject()
export class AccountDto {
    @SerializableField(() => String) id: string;
    @SerializableField(() => String, { name: 'display_name', optional: true })
    displayName?: string;
    @SerializableField(() => Boolean, { defaultValue: false })
    verified: boolean;
    @SerializableField(() => Money, { transformer: MoneyTransformer })
    balance: Money;
}
```

`@SerializableObject()` (class) + `@SerializableField(options?)` (property). The `TypeFunc` for the field type is the first positional parameter; options: `name` (rename in the JSON), `description`, `optional` (default false — a required field missing on deserialize throws), `defaultValue`, `transformer` (a `JsonValueTransformer` constructor for custom value mapping). Metadata is stored in `internal/SerializableMetadata`.

## Functions

- **`serialize(value, options?)`** → `Json`. Projects only the `@SerializableField`s (so internal fields never leak). Handles arrays, applies transformers/renames, and manages cycles via `onCycle: 'error' | 'omit' | 'null'`; also accepts JSON `replacer`/`space`.
- **`deserialize(raw, typeFunc, options?)`** → a typed instance. Validates required fields, applies defaults and transformers. `DeserializeOptions` is `{ strict?: boolean }` — strict mode turns a failed deserialize into an HTTP 400 instead of `undefined`.

## Interfaces

`Serializable` / `Deserializable` (`interfaces/`) let a class implement its own `serialize` / `deserialize(raw, options)` instead of relying on field metadata; `isSerializable` / `isDeserializable` guards detect them.

## Lint parity

`base-lint`'s `serializable-nullable-parity` checks that `@SerializableField({ optional })` agrees with the TypeScript type's nullability (skipping fields that carry a `defaultValue`). See the [lint doc](../../../lint/CLAUDE.md).

## See also

[`rpc/`](../rpc/CLAUDE.md) (deserializes args / serializes results) · [`base-common/json`](../../../common/CLAUDE.md) (`Json`, `JsonValueTransformer`).
