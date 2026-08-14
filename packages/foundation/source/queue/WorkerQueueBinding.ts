// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { TypedBinding } from '../dependency-injection/TypedBinding';

/**
 * Binding for a Cloudflare Queue producer. The name matches the
 * binding declared in `wrangler.toml`. Used with
 * `@InjectWorkerQueue(...)`.
 *
 * The `MessageType` parameter is the type of message the queue
 * accepts; the decorator return type threads it through as
 * `WorkerQueue<MessageType>`.
 */
export class WorkerQueueBinding<MessageType = unknown> extends TypedBinding {
    declare private readonly __workerQueue: MessageType;
}
