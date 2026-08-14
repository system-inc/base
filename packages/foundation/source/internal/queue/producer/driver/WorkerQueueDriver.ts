// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { QueueSendOptions } from '@cloudflare/workers-types';

import { WorkerQueueMessageOptions } from '../../../../queue/producer/WorkerQueue';
import { WorkerQueueMessage } from '../../../../queue/WorkerQueueMessage';

/**
 * The WorkerQueueDriver is used to implement the actual queue infrastructure
 * at the platform specific level.
 */
export interface WorkerQueueDriver {
    /**
     * Submit a batch of messages. Implementations **consume `messages` in
     * place**: each message is removed from the array once it has been
     * accepted by the platform, so on return the array holds only the
     * messages that were not sent. This holds whether the call resolves
     * (array left empty) or rejects part-way (array left with the un-sent
     * remainder) — letting the caller retry exactly the un-sent messages
     * without re-delivering ones the platform already accepted.
     */
    submitMessageBatch(
        messages: WorkerQueueMessageWithOptions[],
        options?: WorkerQueueSubmitOptions,
    ): Promise<void>;
}

/**
 * The options that can be used to submit a message to the worker queue.
 *
 * These options are derived from the Cloudflare Worker's `QueueSendOptions` type.
 */
export type WorkerQueueSubmitOptions = QueueSendOptions;

/**
 * An interface used to specify what options to use when sending a message to the worker queue.
 */
export type WorkerQueueMessageWithOptions = {
    message: WorkerQueueMessage;
    options?: WorkerQueueMessageOptions;
};
