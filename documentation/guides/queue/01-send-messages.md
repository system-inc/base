---
title: Send Messages
description: Declare a queue binding, inject a typed producer, and submit message envelopes.
---

Queues decouple work from requests: a handler submits messages and responds immediately; a [processor](./02-process-messages.md) (in this worker or another) picks them up asynchronously.

## Declare the queue

Three declarations line up. In `wrangler.toml`, the Cloudflare queue and its binding:

```toml
[env.Development]
queues.producers = [{ queue = 'email-queue', binding = 'EMAIL_QUEUE' }]
```

In `settings.ts`, the worker states which producer bindings it uses:

```ts
    queue: {
        bindings: ['EMAIL_QUEUE'],
    },
```

`base check` verifies every settings binding has a matching wrangler producer.

## Bind and inject a typed producer

The shipped pattern is a namespaced token plus a `@Provider` that maps it to the wrangler binding — the indirection keeps the binding name a per-worker decision:

```ts
import { WorkerQueueBinding } from '@system-inc/base-foundation/queue/WorkerQueueBinding';

export interface EmailJob {
    to: string;
    template: string;
}

export namespace EmailInjections {
    export const EmailQueue = new WorkerQueueBinding<EmailJob>(
        'EmailInjections.EmailQueue',
    );
}
```

```ts
import { Provider } from '@system-inc/base-foundation/dependency-injection/decorators/Provider';

export class EmailProviders {
    @Provider(EmailInjections.EmailQueue)
    provideEmailQueue(): string {
        return 'EMAIL_QUEUE';
    }
}
```

Register the provider host in `services`, then inject:

```ts
import { InjectWorkerQueue } from '@system-inc/base-foundation/queue/decorators/InjectWorkerQueue';
import { WorkerQueue } from '@system-inc/base-foundation/queue/producer/WorkerQueue';

@Injectable()
@HttpService()
export class SignupService {
    constructor(
        @InjectWorkerQueue(EmailInjections.EmailQueue)
        private readonly emailQueue: WorkerQueue<EmailJob>,
    ) {}
}
```

## Submit messages

Messages travel in an **envelope**: `{ type, payload }`. The `type` is a routing discriminator — it names which [processor](./02-process-messages.md) handles the message, not the queue:

```ts
@HttpRoute('POST', '/signup')
async signup(@HttpBody(() => SignupInput) input: SignupInput): Promise<Response> {
    // ...create the account...

    this.emailQueue.submit({
        type: 'welcome-email',
        payload: { to: input.email, template: 'welcome' },
    });

    return Response.json({ ok: true });
}
```

`submit` also accepts an array of envelopes for batching, and a second options argument (delivery delay, etc.). It's synchronous — messages are buffered and flushed **after the response is sent**, as a deferred action, so enqueueing never adds latency to the caller.

One queue can carry many message types; give each its own `type` and its own processor.
