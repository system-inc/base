---
title: Use the EventBus
description: Announce that something happened; let listeners react, without the emitter knowing who they are.
---

The event bus decouples _what happened_ from _what happens next_. A service announces `account-created`; listeners handle the welcome email, the audit row, the metrics tick, and the emitting service imports none of them.

## Define an event

An event is any object with a `name`:

```ts
import { BaseEvent } from '@system-inc/base-foundation/event/BaseEvent';

export class AccountCreatedEvent implements BaseEvent {
    readonly name = 'account-created';

    constructor(
        readonly accountId: string,
        readonly email: string,
    ) {}
}
```

## Emit it

Inject the bus (or reach it as [`context.eventBus`](../request-context/01-use-the-request-context.md)) and choose your timing:

```ts
import { BaseEventBus } from '@system-inc/base-foundation/event/BaseEventBus';

@Injectable()
export class AccountService {
    constructor(
        @Inject(BaseEventBus) private readonly eventBus: BaseEventBus,
    ) {}

    async createAccount(input: CreateAccountInput): Promise<AccountEntity> {
        const account = /* ...insert... */;

        this.eventBus.defer(new AccountCreatedEvent(account.id, account.email));
        return account;
    }
}
```

Two emission modes with deliberately different semantics:

- **`defer(event)`** is the usual choice: listeners run **after the response is sent** (as a deferred action). Failures are logged, never thrown, since there's no caller left to receive them.
- **`await publish(event)`**: listeners run **now**, and failures propagate to you. Use when the emitter must know the listeners succeeded.

One gotcha: `defer` is a silent no-op when no listener is registered for the event's name, so a typo'd name simply does nothing. Keep names in shared constants or on the event class, as above.

## Listen

A listener implements `onEvent` and declares its events with `@EventBusListener` (note the import path: the decorator lives in `BaseEventListener`):

```ts
import { BaseEventListener } from '@system-inc/base-foundation/event/BaseEventListener';
import { EventBusListener } from '@system-inc/base-foundation/event/decorators/EventBusListener';
import { AccountCreatedEvent } from '../events/AccountCreatedEvent';

@Injectable()
@EventBusListener('account-created')
export class WelcomeEmailListener implements BaseEventListener<AccountCreatedEvent> {
    constructor(
        @Inject(EmailSendingService)
        private readonly emails: EmailSendingService,
    ) {}

    async onEvent(event: AccountCreatedEvent): Promise<void> {
        await this.emails.send(event.email, 'welcome');
    }
}
```

```ts
    services: [WelcomeEmailListener],
```

`@EventBusListener(['a', 'b'])` subscribes one class to several events. Listeners are resolved lazily from the request-scoped container on first fire, so they can inject request-scoped dependencies like any service.

## Scope

The bus is per-event-scope: one instance per request (or queue batch, or cron tick), created with its container and torn down with it. It's an in-process dispatch mechanism; for work that must survive the current invocation or cross workers, reach for [queues](../queue/01-send-messages.md) instead. A good rule: events for _reactions within this request's world_, queues for _work that stands alone_.

## The framework's own event: unhandled exceptions

The framework defers one event itself: **`UnhandledExceptionEvent`** (name `Base.UnhandledException`), fired whenever a handler throws an error your app didn't model, exactly the errors the framework masks from clients. Intentional client-facing errors (`HttpErrors.*`, validation failures) never fire it. Subscribe to persist failures to a database, notify, or feed an error dashboard:

```ts
import {
    UnhandledExceptionEvent,
    UnhandledExceptionEventName,
} from '@system-inc/base-foundation/event/UnhandledExceptionEvent';

@EventBusListener(UnhandledExceptionEventName)
export class ErrorPersister implements BaseEventListener<UnhandledExceptionEvent> {
    constructor(
        @InjectRepository(ErrorLogEntity)
        private readonly errors: OrmRepository<ErrorLogEntity>,
    ) {}

    async onEvent(event: UnhandledExceptionEvent): Promise<void> {
        await this.errors.insert({
            surface: event.surface, // 'http' | 'rpc' | 'graphql' | 'queue' | 'scheduled' | 'websocket'
            detail: event.detail, // route, procedure, operation, message type, or executable
            requestId: event.requestId,
            ipAddress: event.ipAddress, // caller identity on request surfaces:
            userAgent: event.userAgent, // tell a customer's bug from a crawler probing
            message: String(event.error),
        });
    }
}
```

On the request surfaces (http, rpc, graphql) the event also carries the caller's `ipAddress` and `userAgent`, so a listener can distinguish a customer hitting a real bug from a scanner tripping exceptions; queue, scheduled, and websocket events have no caller and leave them undefined. The framework stores nothing; whether to persist caller identity is your listener's choice.

It covers every dispatch surface, and because it's deferred, your listener runs after the response is sent, so the failing request's 500 is never delayed by your error logging. On surfaces the platform retries (queue, scheduled), the event fires on **every** failed attempt; deduplicate in the listener if you need to. Listener failures are logged and never cascade, so an error in your error logger can't take anything down.

The contract starts at dispatch: failures in worker **boot** (`Base.initialize()`) or in the framework's pre-dispatch request setup can't fire it (the listener ecosystem is part of what hasn't come up yet) and propagate to the platform instead. `base tail` and the platform's request logs are the floor for those.
