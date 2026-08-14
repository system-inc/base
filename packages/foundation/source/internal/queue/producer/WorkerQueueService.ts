// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { InjectionToken } from 'tsyringe';

import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { Dictionary } from '@system-inc/base-common/type/Dictionary';
import { BaseEnvironmentKey } from '../../../configuration/BaseEnvironmentKey';
import { Inject } from '../../../dependency-injection/decorators/Inject';
import { WorkerScoped } from '../../../dependency-injection/decorators/WorkerScoped';
import {
    WorkerQueue,
    WorkerQueueMessageOptions,
} from '../../../queue/producer/WorkerQueue';
import { WorkerQueueMessage } from '../../../queue/WorkerQueueMessage';
import { BaseWorkerContext } from '../../../worker/BaseWorkerContext';
import { CloudflareQueueDriver } from './driver/CloudflareQueueDriver';
import {
    WorkerQueueDriver,
    WorkerQueueMessageWithOptions,
    WorkerQueueSubmitOptions,
} from './driver/WorkerQueueDriver';

/**
 * The WorkerQueueService is used to batch all messages that are destined for all
 * the worker queues. This allows us to submit all messages to the worker queues at once.
 * This is useful for reducing the number of requests to the worker queues and thereby the
 * latency of submitting messages.
 */
@WorkerScoped()
export class WorkerQueueService {
    private readonly queues: Dictionary<WorkerQueueMessageWithOptions[]> = {};
    private readonly queueDrivers: Dictionary<WorkerQueueDriver> = {};

    constructor(
        @Inject(BaseWorkerContext)
        private readonly workerContext: BaseWorkerContext,
    ) {}

    getQueue(queueToken: InjectionToken): WorkerQueue {
        // try to resolve the queue name using the container
        let queueName: string;
        try {
            queueName = this.workerContext.container.resolve(queueToken);
        } catch (e) {
            queueName = queueToken.toString();
        }
        return new WorkerQueue(queueName, this);
    }

    enqueue<MessageType = unknown>(
        queueName: string,
        message:
            | WorkerQueueMessage<MessageType>
            | WorkerQueueMessage<MessageType>[],
        options?: WorkerQueueMessageOptions,
    ): void {
        let queue = this.queues[queueName];
        if (!queue) {
            queue = [];
            this.queues[queueName] = queue;
        }
        if (Array.isArray(message)) {
            for (const msg of message) {
                queue.push({
                    message: msg,
                    options,
                });
            }
        } else {
            queue.push({
                message,
                options,
            });
        }
    }

    async drain(
        queue?: string,
        options?: WorkerQueueSubmitOptions,
    ): Promise<void> {
        if (queue) {
            return this.drainQueue(queue, options);
        }
        // Drain every queue even if one fails, so a single bad queue can't
        // strand the messages buffered for the others; then surface the
        // failure(s) to the caller.
        const errors: unknown[] = [];
        for (const queue of Object.keys(this.queues)) {
            try {
                await this.drainQueue(queue, options);
            } catch (error) {
                errors.push(error);
            }
        }
        if (errors.length === 1) {
            throw errors[0];
        }
        if (errors.length > 1) {
            throw new AggregateError(
                errors,
                `${errors.length} queues failed to drain`,
            );
        }
    }

    private async drainQueue(
        queue: string,
        options?: WorkerQueueSubmitOptions,
    ): Promise<void> {
        // get any messages that need to be sumbitted
        const messages = this.queues[queue];
        if (!messages) {
            return;
        }

        Logger.debug(
            LogCategory.Queue,
            'Draining queue: %s with %d message(s)',
            queue,
            messages.length,
        );

        // get the driver for the queue
        const driver = this.getQueueDriver(queue);
        try {
            // submitMessageBatch consumes `messages` in place, removing each
            // message as it is accepted (see WorkerQueueDriver).
            await driver.submitMessageBatch(messages, options);
        } finally {
            // Drop the buffer entry only once fully drained. On a partial
            // failure the un-sent remainder stays buffered for the next
            // drain, so already-accepted messages are never re-sent.
            if (messages.length === 0) {
                delete this.queues[queue];
            }
        }

        Logger.debug(LogCategory.Queue, 'Drain queue: %s complete', queue);
    }

    private getQueueDriver(queue: string): WorkerQueueDriver {
        let driver = this.queueDrivers[queue];
        if (!driver) {
            driver = this.createQueueDriver(queue);
            this.queueDrivers[queue] = driver;
        }
        return driver;
    }

    private createQueueDriver(queueBinding: string): WorkerQueueDriver {
        // try to bind the queue if we are running on Cloudflare
        if (this.workerContext.configuration.runtime.platform.isCloudflare) {
            const queue =
                this.workerContext.configuration.getEnvironmentVariable(
                    BaseEnvironmentKey.create(queueBinding),
                );
            if (isQueue(queue)) {
                return new CloudflareQueueDriver(queueBinding, queue);
            }
        }

        // otherwise we need to throw an error
        if (this.workerContext.configuration.runtime.platform.isCloudflare) {
            throw new Error(
                `No queue found with name '${queueBinding}'. Did you bind it in wrangler.toml?`,
            );
        } else {
            throw new Error(
                `Queues are currently not supported by platform: ${this.workerContext.configuration.runtime.platform.type}`,
            );
        }
    }
}

// write a function to determine if an unknown implements the Queue interface
function isQueue(value: unknown): value is Queue {
    return (
        value !== null &&
        typeof value === 'object' &&
        'send' in value &&
        'sendBatch' in value
    );
}
