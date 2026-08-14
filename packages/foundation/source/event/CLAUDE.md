# event/ — in-process event bus

A lightweight, typed publish/subscribe bus scoped to the current event (request/queue/scheduled/websocket). Lets code emit domain events that decoupled listeners react to, either immediately or deferred until after the response.

## Pieces

- **`BaseEvent`** — the event contract: just `{ name: string }`. Define your events as types with a `name` discriminator.
- **`BaseEventListener<T>`** — implement `onEvent(event: T)`.
- **`@EventBusListener(events)`** — registers a listener class for one or more event names (marks it in `DecoratorRegistry` + `BaseMetadata.eventBus`). List the class in a module's (or the worker's) `services` — the decorator sorts it into the listener set.
- **`BaseEventBus`** — the bus itself.
- **`UnhandledExceptionEvent`** (`Base.UnhandledException`) — the framework's own event, deferred from every dispatch surface when a handler throws an error the app didn't model (the masked-error boundary: intentional `HttpError`/validation failures don't fire). Fire sites: `BaseRouter.handleError` + `Base.handleRequest` (http), `RpcDispatcher` (rpc), `GqlMiddleware` (graphql), `WorkerQueueConsumer` (queue, per failed attempt — including misconfiguration: unknown or unregistered message types), `ScheduledRunner` (scheduled), `WebSocketService` delegate dispatch (websocket). Request surfaces also stamp the caller's `ipAddress`/`userAgent` (undefined elsewhere). Subscribe with a normal `@EventBusListener` to persist/notify. The contract starts at dispatch — boot (`Base.initialize()`) and pre-dispatch request-setup failures deliberately don't fire (the listener ecosystem is part of what failed / isn't up yet) and propagate to the platform.

## Using it

```ts
@EventBusListener('account.created')
export class WelcomeEmailListener implements BaseEventListener<AccountCreated> {
  async onEvent(event: AccountCreated) { ... }
}

// emit (bus available via RequestContext.eventBus, or injected)
rc.eventBus.defer({ name: 'account.created', accountId })   // after the response
await rc.eventBus.publish({ name: 'account.created', accountId })  // immediately
```

- **`publish(event)`** — emits immediately, awaiting all matching listeners.
- **`defer(event)`** — schedules emission via `DeferredActions` (`BaseInjections.DeferredActions`), so listeners run after the request finishes — the usual choice for side effects that shouldn't block the response. (No-op if no listeners are registered for the event.)

## Scope & resolution

A `BaseEventBus` is created **per child container** by `Base.createChildContainer` (so each request/queue/scheduled/websocket has its own, with that scope's DI). Listeners are resolved lazily (`LazyResolve`) from the container the first time their event fires, so a listener can inject request-scoped dependencies.

## See also

[`base/`](../base/CLAUDE.md) (per-scope bus creation, deferred-action draining) · [`router/`](../router/CLAUDE.md) (`RequestContext.eventBus`).
