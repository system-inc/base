---
title: Custom Rules
description: Author your own validation decorators with registerRule, the same builder the built-ins use.
---

Every built-in rule is made with `registerRule`, and it's public API — your rules are exactly as first-class as the framework's.

## A rule without options

```ts
import { registerRule } from '@system-inc/base-foundation/validation/RegisterRule';

export const VerifyIsSlug = registerRule<void>({
    name: 'IsSlug',
    check: (value) =>
        typeof value === 'string' && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value),
    defaultMessage: ({ property }) =>
        `${property} must be a lowercase slug (words separated by dashes)`,
});
```

```ts
@VerifyIsSlug()
@SerializableField(() => String)
identifier: string;
```

## A rule with options

The generic parameter is the options type; `check` receives it as the second argument:

```ts
export const VerifyDivisibleBy = registerRule<number>({
    name: 'DivisibleBy',
    check: (value, divisor) =>
        typeof value === 'number' && value % divisor === 0,
    defaultMessage: ({ property, options }) =>
        `${property} must be divisible by ${options}`,
});
```

```ts
@VerifyDivisibleBy(5)
@SerializableField(() => Number)
quantity: number;
```

For multiple positional arguments, take an options object (`registerRule<{ min: number; max?: number }>`) — that's how `VerifyLength(min, max?)` is built.

## The definition contract

```ts
registerRule<TOptions>({
    name,           // the constraint key in error responses ("IsSlug")
    operatesOn?,    // 'value' (default) or 'array'
    check,          // (value, options, context) => true | false | string
    defaultMessage, // string, or ({ property, options }) => string
});
```

Three behaviors worth knowing:

- **`check` can return a string**: that's a failure with a custom, per-case message. Only a literal `true` counts as a pass.
- **`operatesOn: 'array'`** makes the rule evaluate an array field as a whole. Value-level rules on array fields run per element, so a rule about the container (size, uniqueness, emptiness) must declare itself array-level or it will never see the array.
- Your rule automatically gets the **`.check()` predicate** for free, like every built-in.

`VerifyBy` (from `validation/decorators/VerifyBy`) is the same function under an alias, if you prefer the naming symmetry with the other decorators.
