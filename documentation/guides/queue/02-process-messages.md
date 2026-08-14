---
title: Process Messages
description: Consume queue messages with typed processors, per message or per batch, with explicit retry control.
---

A processor is a class decorated with `@WorkerQueueProcessor(type)` — the `type` matches the [envelope's discriminator](./01-send-messages.md#submit-messages). Consumers need no settings block: the processor class goes in `services`, and the consumer side of the queue is declared in `wrangler.toml`.

## A per-message processor

```ts
import {
    WorkerQueueProcessorContext,
    WorkerQueueProcessorInterface,
} from '@system-inc/base-foundation/queue/consumer/WorkerQueueProcessor';
import { WorkerQueueProcessor } from '@system-inc/base-foundation/queue/decorators/WorkerQueueProcessor';
import { EmailJob } from '../EmailInjections';

@Injectable()
@WorkerQueueProcessor('welcome-email')
export class WelcomeEmailProcessor implements WorkerQueueProcessorInterface<EmailJob> {
    constructor(
        @Inject(EmailSendingService)
        private readonly emails: EmailSendingService,
    ) {}

    async process(
        job: EmailJob,
        context: WorkerQueueProcessorContext,
    ): Promise<void> {
        await this.emails.send(job.to, job.template);
        // no ack needed — returning successfully acknowledges the message
    }
}
```

- **Success = automatic ack.** Return normally and the framework acknowledges.
- **Throw = retry.** A thrown error leaves the message unacknowledged; Cloudflare redelivers per your `max_retries`. Other messages in the batch still process.
- **Deliberate backoff**: `context.retry({ delaySeconds: 60 })` requeues explicitly. The context also carries `attempts`, `id`, `timestamp`, and the request-scoped `container`.
- `@WorkerQueueProcessor(['type-a', 'type-b'])` handles several message types with one class.

## Batch processing

Implement `processBatch` _instead of_ `process` (if both exist, `process` wins) to see a whole delivery batch at once — useful for bulk writes:

```ts
async processBatch(
    batch: ReadonlyArray<{
        message: EmailJob;
        context: WorkerQueueProcessorContext;
    }>,
): Promise<void> {
    for (const { message, context } of batch) {
        await this.emails.send(message.to, message.template);
        context.acknowledge();
    }
}
```

In batch mode, acknowledge each message as it completes — a throw mid-batch then retries only the unacknowledged remainder.

## The consumer side of wrangler.toml

Delivery tuning (batch size, retries, dead-lettering) is Cloudflare configuration:

```toml
[env.Production]
queues.consumers = [{ queue = 'email-queue', max_batch_size = 10, max_batch_timeout = 5, max_retries = 3, dead_letter_queue = 'email-dlq' }]
```

`base check` requires a consumers entry whenever the worker registers any processor. Messages are grouped by `type` on arrival, and an envelope whose `type` has no registered processor is an error — check your discriminators match end to end.

A worker can be producer, consumer, or both; a dedicated consumer worker is just `services: [WelcomeEmailProcessor]` plus the wrangler consumers block.
