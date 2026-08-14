---
title: Serializable Objects
description: Declare what crosses the wire, field by field, typed in both directions.
---

Serialization is how raw JSON becomes a typed class instance on the way in, and how your objects become JSON on the way out. It's **opt-in per field**: only `@SerializableField` properties cross the wire, so internal state can never leak by accident.

## Declare a shape

```ts
import { SerializableField } from '@system-inc/base-foundation/serialization/decorators/SerializableField';
import { SerializableObject } from '@system-inc/base-foundation/serialization/decorators/SerializableObject';

@SerializableObject()
export class OrderInput {
    @SerializableField(() => String)
    productId: string;

    @SerializableField(() => Number)
    quantity: number;

    @SerializableField(() => String, { optional: true })
    couponCode?: string;

    @SerializableField(() => [String])
    tags: string[];

    @SerializableField(() => ShippingAddress)
    shipping: ShippingAddress;
}
```

- The thunk (`() => Type`) declares the field's type: primitives, `[Type]` arrays, enums, or other serializable classes (nesting recurses).
- Fields **without** the decorator simply don't exist on the wire: in either direction.
- These classes power [`@HttpBody`](../http/03-validate-request-bodies.md), [query/cookie object binding](../http/02-read-request-parameters.md), and [RPC arguments](../rpc/01-use-rpc.md), and stack cleanly with [validation rules](../validation/01-validate-input.md).

## Field options

`@SerializableField(typeFunc, options?)` — the full option set:

| Option         | Effect                                                             |
| -------------- | ------------------------------------------------------------------ |
| `name`         | the JSON key, when it differs from the property name               |
| `optional`     | the field may be absent (pair with `?` on the property)            |
| `defaultValue` | used when the incoming JSON omits the field                        |
| `transformer`  | custom value conversion — see [Transformers](./02-transformers.md) |
| `description`  | documentation metadata                                             |

A `Date` field shows `name` and `transformer` together — stored as a `Date`, wired as an ISO string under a different key:

```ts
import { DateJsonValueTransformer } from '@system-inc/base-common/json/value-transformer/DateJsonValueTransformer';

    @SerializableField(() => Date, {
        name: 'placedAt',
        transformer: DateJsonValueTransformer,
    })
    placedAtDate: Date;
```

## Failure semantics

Deserialization failures are **HTTP 400** (`SERIALIZATION_ERROR`) — malformed JSON, an un-coercible value, an invalid enum member. This is deliberately distinct from validation:

- **Serialization** answers _"is this the right shape?"_ → 400.
- **Validation** answers _"is this acceptable?"_ → 422, with per-field details.

The order is fixed: deserialize first, validate second, handler third. A malformed payload never reaches your rules; a well-formed but unacceptable one never reaches your code.

## Wire interfaces

When a shape is shared with callers (RPC contracts especially) pair the class with a plain interface and `implements` it:

```ts
import { StrictJsonInterface } from '@system-inc/base-common/json/StrictJson';

export type OrderJson = StrictJsonInterface<{
    productId: string;
    quantity: number;
}>;
```

```ts
@SerializableObject()
export class OrderInput implements OrderJson { ... }
```

`StrictJsonInterface` is a compile-time guard: it errors at the type definition if any property isn't JSON-representable (a raw `Date`, a function), and unlike index-signature approaches it admits **only** the keys you declared. The interface travels to the frontend ([Share Types](../rpc/03-share-types.md)); the class stays on the server.
