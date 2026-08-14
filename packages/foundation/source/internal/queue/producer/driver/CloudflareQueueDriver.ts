// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import {
    WorkerQueueDriver,
    WorkerQueueMessageWithOptions,
    WorkerQueueSubmitOptions,
} from './WorkerQueueDriver';

/**
 * A Cloudflare queue driver that sends messages to a Cloudflare queue.
 * https://developers.cloudflare.com/queues/
 */
export class CloudflareQueueDriver implements WorkerQueueDriver {
    constructor(
        private readonly binding: string,
        private readonly queue: Queue,
    ) {}

    private static MAX_BATCH_SIZE = 100;

    async submitMessageBatch(
        messages: WorkerQueueMessageWithOptions[],
        options?: WorkerQueueSubmitOptions,
    ): Promise<void> {
        const now = Date.now();
        // cloudflare batch limits is 100 messages, when exceeding this limit we should split into multiple batches.
        // Remove each chunk from `messages` only after it is accepted, so a
        // failure on a later chunk leaves the caller's buffer holding just
        // the un-sent messages (see WorkerQueueDriver) — never re-delivering
        // an already-accepted chunk.
        while (messages.length > 0) {
            const batchMessages = messages.slice(
                0,
                CloudflareQueueDriver.MAX_BATCH_SIZE,
            );
            await this.queue.sendBatch(
                batchMessages.map((messageWithOptions) => {
                    return {
                        body: messageWithOptions.message,
                        contentType:
                            messageWithOptions.options?.contentType ||
                            options?.contentType,
                        delaySeconds:
                            messageWithOptions.options?.delaySeconds ||
                            options?.delaySeconds,
                    };
                }),
                options,
            );
            messages.splice(0, batchMessages.length);
        }
        const elapsed = Date.now() - now;
        Logger.debug(
            LogCategory.Queue,
            'CloudflareQueueDriver: %s - message submitted to queue in %dms',
            this.binding,
            elapsed,
        );
    }
}
