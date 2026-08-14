# queue/ — worker queues (produce & consume)

Cloudflare Queues, two halves: **producing** (send messages to a queue, batched and flushed after the response) and **consuming** (process an incoming message batch). Consumer dispatch is driven by `Base.handleMessages` on the `@queue` container; producer batching lives in `internal/queue/producer/WorkerQueueService`.

## Producing

```ts
class Bindings { static readonly Email = new WorkerQueueBinding<EmailJob>('EMAIL_QUEUE') }

constructor(@InjectWorkerQueue(Bindings.Email) private email: WorkerQueue<EmailJob>) {}
this.email.submit({ type: 'welcome-email', payload: { to, template } })   // buffered now, flushed after the response
```

- **`WorkerQueueBinding<MessageType>`** — a `TypedBinding` resolved through the DI container first (the shipped idiom: a namespaced token whose `@Provider` returns the wrangler binding name), falling back to the token string as the binding name; the generic threads the message type so `@InjectWorkerQueue` returns a typed `WorkerQueue<MessageType>`.
- **`WorkerQueue<T>`** (`producer/WorkerQueue.ts`) — `submit(message | message[], options?)` where each message is a `WorkerQueueMessage` envelope `{ type, payload }` (`type` is the processor-routing discriminator, not the queue name); options are Cloudflare's `MessageSendRequest` minus `body`. Synchronous — buffers, flushed as a deferred action.
- **`WorkerQueueService`** (`internal/.../producer/WorkerQueueService.ts`, `@WorkerScoped`) — **batches** every message destined for every queue and submits them all at once on `drain()`, cutting request count / latency. The drain is appended as a deferred action by `Base.runDeferredActions`, so messages are flushed in `waitUntil` _after_ the response is returned (see [`base/`](../base/CLAUDE.md)). Drivers under `producer/driver/`: `CloudflareQueueDriver` (real) and the `WorkerQueueDriver` interface.

## Consuming

```ts
@WorkerQueueProcessor('email.send')
export class EmailProcessor implements WorkerQueueProcessorInterface<EmailJob> {
  async process(message: EmailJob, context: WorkerQueueProcessorContext) { ... }
  // or: async processBatch(batch) { ... }
}
```

- **`@WorkerQueueProcessor(type | type[])`** — registers a processor for one or more message types (marks it in `DecoratorRegistry` + `BaseMetadata.queue`). List the class in a module's (or the worker's) `services` — the decorator sorts it into the consumer set.
- **`WorkerQueueProcessorInterface<T>`** — implement `process(message, context)` and/or `processBatch(batch)`.
- **`WorkerQueueProcessorContext`** — the per-message context: the DI `container` + message metadata.
- **`WorkerQueueConsumer`** (`internal/.../consumer`) — invoked by `Base.handleMessages` on a `@queue` child container; routes each message to the processor registered for its type.

## Settings (`WorkerQueueSettings`)

`bindings` — queue producer bindings this worker can send to. Processor classes are contributed through `services` (sorted in by `@WorkerQueueProcessor`). (A worker can be a producer, a consumer, or both.)

## Persisted messages

`OrmPersistedMessageEntity` is an Orm entity that backs a message with a database row (status tracked across processing). The persisted-message status/types are shared via [`base-common/worker-queue`](../../../common/CLAUDE.md).

## See also

[`scheduled/`](../scheduled/CLAUDE.md) (the other deferred-work entry point) · [`base/`](../base/CLAUDE.md) (`handleMessages`, deferred drain).
