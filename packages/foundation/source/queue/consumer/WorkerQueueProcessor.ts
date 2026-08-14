// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseInjectionContainer } from '../../dependency-injection/BaseInjectionContainer';
import { WorkerQueueProcessorMessage } from '../WorkerQueueMessage';

/**
 * A WorkerQueueProcessor is responsible for processing messages that are
 * submitted to a WorkerQueue.
 */
export interface WorkerQueueProcessorInterface<PayloadType = unknown> {
    process?(
        message: PayloadType,
        context: WorkerQueueProcessorContext,
    ): Promise<void>;

    processBatch?(
        batch: ReadonlyArray<{
            message: PayloadType;
            context: WorkerQueueProcessorContext;
        }>,
    ): Promise<void>;
}

/**
 * Provides context about the queue message being processed.
 */
export class WorkerQueueProcessorContext {
    readonly container: BaseInjectionContainer;
    private readonly message: WorkerQueueProcessorMessage;

    constructor(context: WorkerQueueProcessorContext);
    constructor(
        message: WorkerQueueProcessorMessage,
        container: BaseInjectionContainer,
    );
    constructor(
        messageOrContext:
            | WorkerQueueProcessorMessage
            | WorkerQueueProcessorContext,
        container?: BaseInjectionContainer,
    ) {
        if (messageOrContext instanceof WorkerQueueProcessorContext) {
            this.message = messageOrContext.message;
            this.container = messageOrContext.container;
        } else {
            this.message = messageOrContext;
            if (!container) {
                throw new Error(
                    'Container is required when passing a message directly.',
                );
            }
            this.container = container;
        }
    }

    /**
     * The number of times the message has been attempted to be processed.
     */
    get attempts(): number {
        return this.message.attempts;
    }

    /**
     * The unique identifier for the message on the queue.
     */
    get id(): string {
        return this.message.id;
    }

    /**
     * The timestamp when the message was received by the queue.
     */
    get timestamp(): Date {
        return this.message.timestamp;
    }

    /**
     * The type of the message.
     */
    get type(): string {
        return this.message.body.type;
    }

    /**
     * Get the payload of the message as a specific type.
     * @returns
     */
    getMessage<MessageType = unknown>(): MessageType {
        return this.message.body.payload as MessageType;
    }

    /**
     * Acknowledge the message, indicating that it has been processed successfully.
     */
    acknowledge() {
        this.message.ack();
    }

    /**
     * Retry the message, indicating that it should be reprocessed.
     * @param options The options for retrying the message.
     */
    retry(options?: QueueRetryOptions) {
        this.message.retry(options);
    }
}
