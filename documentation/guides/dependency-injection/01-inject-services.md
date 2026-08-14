---
title: Inject Services
description: Make a class injectable, take dependencies in the constructor, and keep logic out of handlers.
---

Dependency injection in Base is deliberately quiet: mark a class `@Injectable()`, ask for what you need in the constructor, and the container does the rest. You've been using it since your first worker.

## The basic pattern

A plain service holds the logic:

```ts
import { Injectable } from '@system-inc/base-foundation/dependency-injection/decorators/Injectable';

@Injectable()
export class GreetingService {
    greet(name?: string): string {
        const trimmed = name?.trim();
        return `Hello, ${trimmed || 'world'}!`;
    }
}
```

Any other class asks for it by type:

```ts
import { Inject } from '@system-inc/base-foundation/dependency-injection/decorators/Inject';
import { Injectable } from '@system-inc/base-foundation/dependency-injection/decorators/Injectable';

@Injectable()
@HttpService()
export class HelloWorldService {
    constructor(
        @Inject(GreetingService)
        private readonly greetingService: GreetingService,
    ) {}
}
```

That's it. No registration list for injectables — being decorated and imported is enough. (Classes with a _dispatch_ decorator (`@HttpService`, `@GqlResolver`, `@RpcService`) still go in `services`, but that lists what your worker exposes, not what it can inject.)

Two rules keep this predictable:

- **A class that injects needs `@Injectable()`** (or one of the lifetime decorators from [Lifetimes and Scopes](./02-lifetimes-and-scopes.md)). A class with no constructor dependencies (like `RouterTestService` in the framework's own examples) can skip it.
- **Tokens are always typed.** You inject by class, by `TypedInjectionKey<T>`, or by a `TypedBinding` — never by bare string. Base's lint rules statically check that the parameter's type matches what the token resolves to, so a miswired injection is a compile-time error, not a runtime surprise.

## Optional and lazy injection

Two useful variants, same shape:

```ts
import { InjectLazy } from '@system-inc/base-foundation/dependency-injection/decorators/InjectLazy';
import { InjectOptional } from '@system-inc/base-foundation/dependency-injection/decorators/InjectOptional';

    constructor(
        // undefined instead of a throw when nothing is registered
        @InjectOptional(MetricsService)
        private readonly metrics: MetricsService | undefined,

        // resolved on first use — breaks construction-order cycles,
        // defers expensive construction
        @InjectLazy(ReportBuilder)
        private readonly reports: LazyInstance<ReportBuilder>,
    ) {}
```

`@InjectAll(token)` injects every registration of a token as an array — the standard plugin pattern.

## Why services, not fat handlers

Handlers (HTTP routes, resolvers, RPC procedures) should orchestrate; injectable services should do the work. The payoff is the one the scaffold demonstrates on day one: `GreetingService` is reusable from any handler _and_ unit-testable with `new GreetingService()` — no worker, no container, no HTTP.

## Module membership (the `moduleKey` argument)

Every injectable-family decorator accepts an optional `BaseModuleKey`: `@Injectable(FileStorageModuleKey)`. This declares which module the class belongs to, and it's what routes token-less `@InjectRepository`/`@InjectDatabase` to that module's database ([Multiple Databases](../orm/07-multiple-databases.md)). If your worker has one database, you'll never need it.
