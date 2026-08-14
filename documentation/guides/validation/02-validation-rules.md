---
title: Validation Rules
description: 'The built-in rule catalog: type checks, ranges, formats, and array-level rules.'
---

Every rule is one decorator, imported from its own file (`@system-inc/base-foundation/validation/decorators/<Name>`). This is the full built-in catalog.

## Type checks

`@VerifyIsString()` · `@VerifyIsNumber()` · `@VerifyIsInt()` · `@VerifyIsBoolean()` · `@VerifyIsDate()` · `@VerifyIsObject()` · `@VerifyIsArray()` · `@VerifyIsDefined()` · `@VerifyIsEnum(EnumOrValues)`

## Ranges and lengths

- `@VerifyMin(n)` / `@VerifyMax(n)`: numeric bounds (inclusive).
- `@VerifyMinLength(n)` / `@VerifyMaxLength(n)`: string length bounds.
- `@VerifyLength(min, max?)`: combined length bounds.
- `@VerifyMinDate(date)` / `@VerifyMaxDate(date)`: date bounds.

## Formats

- `@VerifyIsEmail()` · `@VerifyIsUrl()` · `@VerifyIsDomain()` · `@VerifyIsUUID(version?)` · `@VerifyIsIP(version?)`
- `@VerifyIsPhoneNumber(options?)`: E.164, NANP, or international.
- `@VerifyIsCountryCode(format?)`: alpha-2, alpha-3, or numeric.
- `@VerifyIsLocale()` · `@VerifyIsTimeZone()`
- `@VerifyStringMatches(pattern)`: regex.

## Presence and emptiness

- `@VerifyIsNotEmpty()`: rejects `null`, `undefined`, `''`, `[]`, and `{}`. Numbers (including `0`), booleans, and class instances are never "empty."
- `@VerifyIsOptional()` — the opt-out sentinel: marks a field as allowed to be absent, so other rules on it only run when a value is present.

## Array rules

Most rules run per element when placed on an array field. A few operate on the array itself:

- `@VerifyArrayMinSize(n)` / `@VerifyArrayMaxSize(n)`: element count bounds.
- `@VerifyArrayUnique()`: no duplicate elements.
- `@VerifyIsArray()`: the value is an array at all.
- `@VerifyIsNotEmpty()` is also array-level by design: on an array field it checks the array (an empty array fails), not each element.

```ts
@VerifyArrayMinSize(1)
@VerifyArrayUnique()
@SerializableField(() => [String])
tags: string[];
```

## Rules double as predicates

Every rule carries a standalone `.check()` you can call anywhere, outside any decorator:

```ts
import { VerifyIsEmail } from '@system-inc/base-foundation/validation/decorators/VerifyIsEmail';
import { VerifyLength } from '@system-inc/base-foundation/validation/decorators/VerifyLength';

VerifyIsEmail.check('ada@example.com'); // true
VerifyLength.check('hi', 3, 10); // false
```

Handy for imperative checks in services — same rule, same semantics, no duplicate logic.

Need a rule that doesn't exist? [Write your own](./03-custom-rules.md) — the built-ins are all made with the same public builder.
