---
title: Decorators and Boot
description: What a decorator records at script evaluation, how the application is assembled on the first event, and what runs per request.
---

Base applications are described with decorators: `@HttpService`, `@OrmTable`, `@GqlResolver`, `@Injectable`. This guide is the mechanism behind them — what runs when, and where the information goes. It's worth reading once; everything else in the guides assumes this model.

## A decorator is a function

A decorator is not syntax the framework interprets. It is an ordinary function that JavaScript calls while your module is being evaluated — before any request exists, before the framework has started. Here is `@HttpRoute`, in full:

```ts
export function HttpRoute(
    method: HttpMethodType | HttpMethodType[],
    route: string,
): MethodDecorator {
    return (
        target: object,
        propertyKey: string | symbol,
        descriptor: PropertyDescriptor,
    ) => {
        routerMetadataAddRoute(target.constructor as Constructor, {
            path: route,
            method: method,
            parameterLength: descriptor.value.length,
            routeHandler: String(propertyKey),
        });
    };
}
```

That is the whole thing. It records a description of the route against the class and returns. Nothing executes behind your back afterward, and nothing watches your code.

## Two registries: what a class is, and the details

Decorators write to two different places, and the split explains most of Base's boot behavior.

**The `DecoratorRegistry` records what a class _is_.** Class-level decorators mark their target with a name:

```ts
export function HttpService(): ClassDecorator {
    return (target) => {
        const ctor = target as Constructor<object>;
        DecoratorRegistry.get().mark(ctor, HttpServiceDecoratorName);
        routerMetadataAddService(ctor);
    };
}
```

The marks live in per-name `WeakSet`s, so decorating a class doesn't prevent it from being garbage collected. This registry answers one question (_did this class carry `@HttpService`?_) and that answer is what lets the framework sort a class into its dispatch surface at boot.

**Subsystem metadata records the specifics.** The route path, the column type, the queue message type, the cron expression — those go into the relevant subsystem's metadata (`routerMetadataAddRoute` above, and `BaseMetadata` for queue processors and scheduled executables). One decorator, one fact, written once.

## Registration is separate from declaration

Marking a class doesn't put it in your application. You list it in a module's `services` (or the worker's), and the module goes in `BaseSettings.modules`:

```ts
export const NotesModule = BaseModule.create({
    key: NotesModuleKey,
    settings: {
        services: [NoteService, NoteRpcService, NoteResolver],
        orm: { entities: [NoteEntity] },
    },
});
```

`services` is one flat list for every kind of class. There is no separate list of routes, resolvers, or processors — the decorator already said what each class is, and a second list would only restate it. See [Create a Module](../modules/01-create-a-module.md) for the full settings shape.

## Assembly happens once, on the first event

Recording is not wiring. When the first event reaches your worker (an HTTP request, a queue message, a cron trigger) `Base.initialize()` assembles the application:

1. Reads your `settings.ts` and flattens every module (and the modules they `use`) into one application manifest;
2. Walks each `services` list, looks up what each class declared about itself in the `DecoratorRegistry`, and sorts it into its dispatch surface(s);
3. Validates the result;
4. Binds the surfaces: GraphQL, WebSocket, and RPC routes, then the HTTP routes;
5. Runs module `onInitialize` hooks and initializes the platform delegate.

`initialize()` is idempotent and concurrency-safe: the first caller starts the work, and callers that arrive mid-flight await that same run rather than racing ahead against half-bound routes. If it throws, the stored promise is cleared so the next event retries instead of leaving the worker permanently wedged.

So there are exactly two phases, and you can observe both:

- **Script evaluation** — your modules load, decorators run, metadata is recorded. This is the startup that `wrangler check startup` profiles: plain function calls.
- **First-event assembly**: settings are resolved, the registry is read, surfaces are bound, validation runs.

There is no third phase. Dispatch does not re-read your annotations.

## Mistakes surface at boot

Because assembly consults the registry, a class that carries no recognized decorator can't be placed, and Base treats that as an error rather than a silently inert registration:

```
Class "NoteService" is listed in services but carries no recognized base
decorator, so it would do nothing. Add the decorator that declares what it
is — a dispatch decorator (@GqlResolver, @HttpService, @RpcService,
@WorkerQueueProcessor, @ScheduledExecutable, @EventBusListener), an
injectable-family decorator (@Injectable, @WorkerScoped, @ContainerScoped,
@ResolutionScoped, @Singleton), or a @Provider method. Entities belong under
orm entities, not services.
```

The manifest's `validate()` also checks the slots that aren't decorator-sorted (`orm.entities` classes must carry `@OrmTable`) and cross-checks declared [module membership](../dependency-injection/01-inject-services.md) against the module graph.

## Per event: a fresh scoped container

After assembly, each event gets a child dependency-injection container off the worker container: `@request`, `@queue`, `@scheduled`, or `@websocket`. The dispatcher resolves your handler from that container, runs middleware, deserializes and validates the input, and calls your method. Deferred work runs after the response, then the container is disposed.

Dispatch is direct: a bound route calls your method. There is no reflection at dispatch time and no per-request interpretation of your annotations. See [Lifetimes and Scopes](../dependency-injection/02-lifetimes-and-scopes.md) for what lives in which scope.

## What this buys you

A decorated class is still a plain class. Strip the decorators off `NoteService` and you have a constructible, unit-testable class whose methods you can call directly — the annotations sit beside your code rather than around it. That is what makes [unit tests](../testing/01-unit-tests.md) plain `new NoteService(...)` calls with no worker, no container, and no HTTP.

It also means every behavior in your application traces to a declaration you can point at: the class is in `services` because you listed it, and it does what it does because of the decorator written on it.
