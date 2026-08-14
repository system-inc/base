---
title: Transformers
description: Convert values between their runtime type and their wire representation, per field.
---

A transformer converts one field between its in-memory type and its JSON representation. Attach it with the `transformer` option; Base instantiates it and calls `fromJson` on the way in, `toJson` on the way out.

## The built-ins

**`DateJsonValueTransformer`** — `Date` ⇄ ISO-8601 string. Accepts a string, `Date`, or epoch number inbound:

```ts
import { DateJsonValueTransformer } from '@system-inc/base-common/json/value-transformer/DateJsonValueTransformer';

    @SerializableField(() => Date, { transformer: DateJsonValueTransformer })
    createdAt: Date;
```

**`CommaSeparatedJsonValueTransformer`** — `string[]` ⇄ `"a,b,c"`. Made for query parameters:

```ts
import { CommaSeparatedJsonValueTransformer } from '@system-inc/base-common/json/value-transformer/CommaSeparatedJsonValueTransformer';

@SerializableObject()
export class SearchQuery {
    // ?tags=cloud,workers,edge → ['cloud', 'workers', 'edge']
    @SerializableField(() => [String], {
        transformer: CommaSeparatedJsonValueTransformer,
    })
    tags: string[];
}
```

**`JsonObjectValueTransformer`** — an embedded JSON object in a string value (`?metadata={"key":"value"}`); yields `null` when missing or invalid.

## Write your own

Implement the two-method interface:

```ts
import { Json } from '@system-inc/base-common/json/Json';
import { JsonValueTransformer } from '@system-inc/base-common/json/value-transformer/JsonValueTransformer';

export class CentsJsonValueTransformer implements JsonValueTransformer<number> {
    // wire carries integer cents; runtime works in dollars
    fromJson(v: unknown): number {
        if (typeof v !== 'number' || !Number.isInteger(v)) {
            throw new Error(`Invalid cents value: ${v}`);
        }
        return v / 100;
    }

    toJson(v: number): Json {
        return Math.round(v * 100);
    }
}
```

```ts
@SerializableField(() => Number, { transformer: CentsJsonValueTransformer })
price: number;
```

Note the option takes the **class**, not an instance — Base constructs it per use. Throw from `fromJson` for un-parseable input and the request fails as a 400 serialization error, before validation or your handler.

## When to reach for one

Transformers are for **representation** mismatches: dates, money-as-cents, comma-packed lists, embedded JSON. If what you actually want is to _reject_ values, that's a [validation rule](../validation/03-custom-rules.md); if you want a different JSON key, that's the `name` option. Keep each mechanism doing its own job.
