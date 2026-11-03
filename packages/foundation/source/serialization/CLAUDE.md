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
- **`deserialize(raw, typeFunc, options?)`** → a typed instance. Validates required fields, applies defaults and transformers. A class type requires a JSON object: a primitive or an array where the `TypeFunc` declares a single object is a 400 (`SERIALIZATION_ERROR`), at the top level or in a nested field. (A bare constructor rather than a `TypeFunc` still maps a raw array to an array of instances.) `DeserializeOptions` is `{ strict?: boolean }` — strict mode turns a failed deserialize into an HTTP 400 instead of `undefined`.

## JSON Schema (`GenerateJsonSchema.ts`, `JsonSchema.ts`)

`generateJsonSchema(type)` returns a draft 2020-12 schema describing a type's **declared contract**; `JsonSchemaBuilder` composes several types over one shared `$defs` (`schemaFor` per part, `document(root)` to attach them), and `jsonSchemaRootClass(type)` names the class a root type inlines. Structure comes from serialization metadata — wire names, `TypeFunc` types (`Date` → string, `[T]` → array, enums → `enum`, nested `@SerializableObject` classes → `$defs` + `$ref`), `required` unless `optional`/defaulted, `default`, `description`; a `transformer` field is `{}`. Constraints come from each `@Verify*` rule's `jsonSchema` mapping (see [`validation/`](../validation/CLAUDE.md)), applied as the engine applies rules (value-level rules on an array field go to `items` once an array-level rule is present) and merged: bounds keep the tighter value, `type`/`enum` intersect, a second `pattern` goes in `allOf`. A root class is inlined; output is deterministic (declaration order, sorted `$defs`, same-named classes suffixed `_2`). The server is more lenient than the schema in two ways it doesn't advertise: `deserialize` coerces mistyped primitives (`String(42)`) and passes `null` through for any present field.

## Interfaces

`Serializable` / `Deserializable` (`interfaces/`) let a class implement its own `serialize` / `deserialize(raw, options)` instead of relying on field metadata; `isSerializable` / `isDeserializable` guards detect them.

## Lint parity

`base-lint`'s `serializable-nullable-parity` checks that `@SerializableField({ optional })` agrees with the TypeScript type's nullability (skipping fields that carry a `defaultValue`). See the [lint doc](../../../lint/CLAUDE.md).

## See also

[`rpc/`](../rpc/CLAUDE.md) (deserializes args / serializes results) · [`base-common/json`](../../../common/CLAUDE.md) (`Json`, `JsonValueTransformer`).
