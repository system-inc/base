// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Base class for typed bindings to string-named external resources
 * (Cloudflare Durable Object namespaces, queues, R2 buckets, KV
 * namespaces, RPC service bindings, etc.).
 *
 * A binding identifies an external resource by name and carries enough
 * type information for typed inject decorators (`@InjectDurableObjectProvider`,
 * `@InjectWorkerQueue`, etc.) to express their resolution contract via
 * `TypedParameterDecorator<TResolved>`.
 *
 * Concrete subclasses each carry a unique phantom brand so TypeScript
 * distinguishes them structurally — passing a `DurableObjectBinding`
 * to `@InjectWorkerQueue` is a compile error, not a runtime surprise.
 *
 * Bindings are typically defined as static members of a `*Injections`
 * class:
 *
 * ```ts
 * export class StripeInjections {
 *     static readonly WebhookEventQueue =
 *         new WorkerQueueBinding<StripeWebhookEvent>('Stripe.WebhookEventQueue');
 * }
 * ```
 */
export abstract class TypedBinding {
    constructor(public readonly name: string) {}

    toString(): string {
        return this.name;
    }
}
