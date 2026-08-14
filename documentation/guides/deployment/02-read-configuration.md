---
title: Read Configuration
description: Consume environment variables and module settings from code, with typed keys, required values, and secrets that can't leak.
---

[Environments and Configuration](./01-environments-and-configuration.md) covered how values get _into_ an environment. This guide is the other half: how your code reads them — always through typed keys, never by rummaging in a raw env object.

## Declare a typed key

```ts
import { BaseEnvironmentKey } from '@system-inc/base-foundation/configuration/BaseEnvironmentKey';

export class BillingEnvironment {
    static readonly WebhookUrl = BaseEnvironmentKey.create<string>(
        'BILLING_WEBHOOK_URL',
    );

    static readonly StripeKey =
        BaseEnvironmentKey.createSecret('STRIPE_SECRET_KEY');
}
```

A key names one variable and carries its type. This is deliberate design, not ceremony: modules declare exactly the variables they need, so nothing gets bulk access to the full environment — which may contain other modules' secrets.

## Read it

Inject `BaseConfiguration` and read by key:

```ts
import { BaseConfiguration } from '@system-inc/base-foundation/configuration/BaseConfiguration';
import { Inject } from '@system-inc/base-foundation/dependency-injection/decorators/Inject';
import { Injectable } from '@system-inc/base-foundation/dependency-injection/decorators/Injectable';

@Injectable()
export class BillingService {
    private readonly webhookUrl: string;

    constructor(
        @Inject(BaseConfiguration)
        private readonly configuration: BaseConfiguration,
    ) {
        this.webhookUrl = configuration.requireEnvironmentVariable(
            BillingEnvironment.WebhookUrl,
        );
    }
}
```

Two accessors with honest types:

- **`getEnvironmentVariable(key)`** → `T | undefined`: for optional values; you handle absence.
- **`requireEnvironmentVariable(key)`** → `T`: throws `Required environment variable 'X' is not set.` Fail at construction time, not on the first request that needed it.

The value comes from the fully-layered environment ([wrangler vars → workspace `env.toml` → worker `env.toml`](./01-environments-and-configuration.md#how-variables-flow)) for the active environment — your code never knows or cares which file supplied it.

## Secrets that can't leak

Keys declared with **`createSecret`** resolve to a `Secret<string>` instead of a raw string:

```ts
const stripeKey = configuration.requireEnvironmentVariable(
    BillingEnvironment.StripeKey,
);

console.log(stripeKey);           // logs the wrapper, never the value
await stripe.charge(stripeKey.reveal(), ...);   // explicit, greppable escape
```

A `Secret` cannot flow into logs or JSON — the _only_ way to the underlying value is `.reveal()`, which makes every escape point auditable with a one-line grep. Use `createSecret` for anything you'd be unhappy to see in a log line; the framework treats its own sensitive variables the same way.

## Structured values

`env.toml` is TOML, so values can be arrays and tables, and the typed key carries the shape:

```toml
[Production]
BILLING_PLANS = [
    { name = "starter", priceId = "price_123" },
    { name = "pro", priceId = "price_456" },
]
```

```ts
interface BillingPlan {
    name: string;
    priceId: string;
}

static readonly Plans =
    BaseEnvironmentKey.create<BillingPlan[]>('BILLING_PLANS');
```

This is the same mechanism the framework uses for its own `DATABASES` and `ENCRYPTION_KEYS` variables. One caveat inherited from transport: values that crossed a plain-string boundary can arrive as JSON strings — if a structured value might come from outside `env.toml`, accept `string | T[]` and parse when it's a string, exactly as the framework's own consumers do.

## Module settings

Configuration a _module_ takes at registration (`Notes({ maxNoteLength: 500 })`) is read back through the module's key, fully typed:

```ts
const settings = configuration.getModuleSettings(NotesModuleKey);
settings.maxNoteLength; // number | undefined — typed by the key's generic
```

That's the standard pattern inside [module](../modules/01-create-a-module.md) services and providers: inject `BaseConfiguration`, read your module's settings once, keep them in a field.

## Choosing the mechanism

| Value                               | Home                     | Read via                       |
| ----------------------------------- | ------------------------ | ------------------------------ |
| Differs per environment, or secret  | `env.toml`               | `BaseEnvironmentKey`           |
| Behavior/configuration of the app   | `settings.ts`            | settings / `getModuleSettings` |
| Deploy provenance (`COMMIT_SHA`, …) | stamped by `base deploy` | `BaseEnvironmentKey`           |

Rule of thumb: `settings.ts` is _what the app is_ (code-reviewed, committed); `env.toml` is _what this environment knows_ (gitignored, per-machine or CI-injected). If you'd commit it, it's settings.
