// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { WorkerQueueService } from '../../internal/queue/producer/WorkerQueueService';
import { WorkerQueueMessage } from '../WorkerQueueMessage';

/**
 * The options that can be used to send a message to the worker queue.
 *
 * These options are derived from the Cloudflare Worker's `MessageSendRequest` type.
 */
export type WorkerQueueMessageOptions = Omit<MessageSendRequest, 'body'>;

/**
 * A WorkerQueue is a queue that can be used to submit messages processing by a
 * different consuming worker. This allows you to offload work to a different
 * worker to be processed after the current worker has finished handling the request.
 */
export class WorkerQueue<DefaultMessageType = unknown> {
    constructor(
        readonly queue: string,
        private readonly queueService: WorkerQueueService,
    ) {}

    submit<MessageType extends DefaultMessageType = DefaultMessageType>(
        message:
            | WorkerQueueMessage<MessageType>
            | WorkerQueueMessage<MessageType>[],
        options?: WorkerQueueMessageOptions,
    ): void {
        this.queueService.enqueue(this.queue, message, options);
    }
}
