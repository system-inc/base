---
title: JSON Schema
description: Generate a JSON Schema (2020-12) for a serializable type from the metadata you already declared.
---

`generateJsonSchema(type)` describes a type the way `deserialize` reads it, using the decorators you have already written. You don't add schema annotations.

```ts
import { generateJsonSchema } from '@system-inc/base-foundation/serialization/GenerateJsonSchema';

@SerializableObject()
export class InviteInput {
    @VerifyIsEmail()
    @SerializableField(() => String, { description: 'Who to invite.' })
    email: string;

    @VerifyIsOptional()
    @VerifyMaxLength(40)
    @SerializableField(() => String, { name: 'note_text', optional: true })
    note?: string;

    @VerifyArrayMinSize(1)
    @SerializableField(() => [String])
    roles: string[];
}

generateJsonSchema(InviteInput);
// {
//   type: 'object',
//   properties: {
//     email: { type: 'string', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$', description: 'Who to invite.' },
//     note_text: { type: 'string', maxLength: 40 },
//     roles: { type: 'array', items: { type: 'string' }, minItems: 1 },
//   },
//   required: ['email', 'roles'],
// }
```

## Where each part comes from

- **Structure comes from `@SerializableField`.** Properties use the wire name (`name`), and each type comes from the field's `TypeFunc`: `String`, `Number` and `Boolean` map to their JSON types, `Date` maps to a string, `[T]` maps to an array, an enum maps to `enum`, and a nested `@SerializableObject` class goes in `$defs` as a `$ref`. A field is `required` unless it's `optional` or has a `defaultValue`, which is emitted as `default`. Its `description` is emitted too.
- **Constraints come from `@Verify*` rules.** As in validation, value-level rules on an array field apply to each item once the field also has an array-level rule (`@VerifyArrayMinSize`, `@VerifyIsArray`, …).
- **A field with a `transformer` is `{}`.** Its wire shape is whatever the transformer reads, so the generator doesn't guess it.

A class at the root is inlined (an object schema with `$defs` beside it). An array or primitive at the root isn't. Output is deterministic, so schemas can be compared in tests and diffs.

## The schema is never stricter than a rule

Every value a rule accepts passes the keywords the rule maps to. When a rule can't be expressed exactly, the schema leaves it out or keeps only the part it can express:

- `@VerifyIsUrl`, `@VerifyIsPhoneNumber`, `@VerifyIsTimeZone`: just `type: 'string'`. No `format` is emitted, because a validator that enforces formats can be stricter than the check.
- `@VerifyStringMatches`: a `pattern` only for a regex with no flags that means the same under the `u` flag JSON Schema validators commonly use. `/^abc$/i` has no flagless equivalent, so it becomes just `type: 'string'`.
- `@VerifyArrayUnique`: `uniqueItems` only for primitive items. The rule compares items by identity, so two equal objects pass it.
- Date rules: none. Dates cross the wire as strings.

**One exception: length minimums.** `@VerifyMinLength` and `@VerifyLength` count UTF-16 code units, while JSON Schema counts code points. The schema keeps the rule's number, so a string of emoji can meet the rule's minimum and still fail the schema's.

The schema describes the **declared contract**, which is a little stricter than what the server accepts. `deserialize` coerces a mistyped primitive (`42` sent for a string field arrives as `"42"`), and it accepts `null` for any field that's present. The schema advertises neither.

## Custom rules

A rule you write with `registerRule` is left out of schemas unless it declares a `jsonSchema` mapping. See [Custom Rules](../validation/03-custom-rules.md#json-schema).

## Composing several types

`JsonSchemaBuilder` builds schemas that share one `$defs`. Use it when a document combines several types, such as an object whose properties are separate argument types:

```ts
const builder = new JsonSchemaBuilder();
const schema = builder.document({
    type: 'object',
    properties: {
        input: builder.schemaFor(() => InviteInput),
        dryRun: builder.schemaFor(() => Boolean),
    },
});
```
