---
title: Typed Keys and Providers
description: Inject values and interfaces (not just classes) with TypedInjectionKey and @Provider.
---

Classes inject by their own type. Everything else — configuration values, interfaces with swappable implementations, computed objects — injects through a **typed key** plus a **provider**.

## Define a typed key

By convention, keys live as static members of an `*Injections` class:

```ts
import { TypedInjectionKey } from '@system-inc/base-foundation/dependency-injection/TypedInjectionKey';

export class BillingInjections {
    static readonly StripeApiKey = new TypedInjectionKey<string>(
        'BillingInjections.StripeApiKey',
    );
}
```

The generic (`<string>`) is the contract: lint verifies that whatever a provider returns for this key, and whatever type a consumer declares for it, both match. Bare string or symbol tokens are rejected by design — every token carries a static type.

Use the **same key instance** at registration and injection (import it; don't construct a second copy) — token identity is reference-based.

## Provide a value

A provider is a method decorated with `@Provider(key)`, hosted on a class listed in `services`:

```ts
import { Provider } from '@system-inc/base-foundation/dependency-injection/decorators/Provider';
import { BillingInjections } from './BillingInjections';

export class BillingProviders {
    @Provider(BillingInjections.StripeApiKey)
    static stripeApiKey(): string {
        return mustGetEnvironmentValue('STRIPE_API_KEY');
    }
}
```

```ts
    services: [BillingProviders],
```

Provider hosts go in the same `services` list as everything else — that's how the worker knows they exist.

## Consume it

```ts
@Injectable()
export class StripeClient {
    constructor(
        @Inject(BillingInjections.StripeApiKey)
        private readonly apiKey: string,
    ) {}
}
```

Declare the parameter as anything other than `string` and lint objects — the key's generic is enforced at both ends.

## Patterns

- **Interface + implementation**: define `TypedInjectionKey<PaymentGateway>`, provide the concrete class, and consumers depend only on the interface. Swap implementations in one place (tests included).
- **Caching**: `@Provider(key, { factoryType: 'caching' })` memoizes the factory result instead of re-running it per resolution.
- **System keys**: the framework exposes its own typed keys: notably `BaseInjections.DeferredActions`, the per-request deferred executor for scheduling post-response work (also reachable as `context.deferred` — see [Use the RequestContext](../request-context/01-use-the-request-context.md)).
