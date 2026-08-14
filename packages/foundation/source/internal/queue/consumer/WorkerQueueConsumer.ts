// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { InjectionToken } from 'tsyringe';

import { LogCategory } from '@system-inc/base-common/logging/LogCategory';
import { Logger } from '@system-inc/base-common/logging/Logger';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { getBaseMetadata } from '../../../base/BaseMetadata';
import { BaseInjectionContainer } from '../../../dependency-injection/BaseInjectionContainer';
import { BaseEventBus } from '../../../event/BaseEventBus';
import {
    UnhandledExceptionEvent,
    UnhandledExceptionEventName,
} from '../../../event/UnhandledExceptionEvent';
import {
    WorkerQueueProcessorContext,
    WorkerQueueProcessorInterface,
} from '../../../queue/consumer/WorkerQueueProcessor';
import { WorkerQueueProcessorMessage } from '../../../queue/WorkerQueueMessage';
import { WorkerQueueMetadata } from '../../metadata/WorkerQueueMetadata';

/**
 * A WorkerQueueConsumer is responsible for taking the messages delivered to the
 * WorkerQueue and processing them using the appropriate WorkerQueueProcessor.
 */
export class WorkerQueueConsumer {
    private readonly metadata: WorkerQueueMetadata;

    constructor(
        protected readonly container: BaseInjectionContainer,
        private readonly processors: ReadonlyArray<
            Constructor<WorkerQueueProcessorInterface>
        >,
    ) {
        this.metadata = getBaseMetadata().queue;
    }

    async processMessages(
        messages: ReadonlyArray<Readonly<WorkerQueueProcessorMessage>>,
    ): Promise<void> {
        // batch by type for efficiency
        // this way we only call each processor once per type
        const batchedMessages = new Map<
            string,
            WorkerQueueProcessorMessage[]
        >();
        for (const message of messages) {
            const type = message.body.type;
            if (!batchedMessages.has(type)) {
                batchedMessages.set(type, []);
            }
            batchedMessages.get(type)?.push(message);
        }

        // process each batch serially
        let rethrow: unknown | undefined = undefined;
        for (const [type, typedMessages] of batchedMessages.entries()) {
            try {
                await this.processMessageBatches(type, typedMessages);
            } catch (error) {
                // we need to catch so that we can try to process as
                // many messages from the batch as possible
                rethrow = error;
            }
        }
        if (rethrow) {
            // if we have an error, we need to rethrow it so that the
            // queue can handle it and retry the unacked messages
            throw rethrow;
        }
    }

    private async processMessageBatches(
        type: string,
        messages: ReadonlyArray<Readonly<WorkerQueueProcessorMessage>>,
    ): Promise<void> {
        Logger.debug(
            LogCategory.Queue,
            'Processing %d message(s) of type: %s',
            messages.length,
            type,
        );

        try {
            // lookup the processor for the incoming message type — inside
            // the try so a misconfiguration (unknown type, unregistered or
            // opted-out processor) fires the unhandled-exception event
            // below, exactly like a processor failure. It is only
            // detectable now: message types are runtime data from
            // producers, and an imported-but-unregistered processor is
            // legitimate at boot (module `queue: false` opt-outs).
            const processorType = this.metadata.getQueueProcessor(type);
            if (!processorType) {
                throw new Error(
                    `Failed to find processor for message type: ${type}`,
                );
            }
            // make sure the processor is registered in settings
            if (!this.processors.includes(processorType)) {
                throw new Error(
                    `Processor for message type: ${type} is not registered`,
                );
            }

            // create the processor for the type of message
            const processor =
                this.container.resolve<WorkerQueueProcessorInterface>(
                    processorType as InjectionToken,
                );

            if (processor.process) {
                let rethrow: unknown | undefined = undefined;
                for (const message of messages) {
                    // process each message of the batch individually
                    try {
                        await processor.process(
                            message.body.payload,
                            new WorkerQueueProcessorContext(
                                message,
                                this.container,
                            ),
                        );
                        message.ack();
                    } catch (error) {
                        // we need to catch so that we can try to process as
                        // many messages from the batch as possible
                        rethrow = error;
                    }
                }
                if (rethrow) {
                    // if we have an error, we need to rethrow it so that the
                    // queue can handle it and retry the message
                    throw rethrow;
                }
            } else if (processor.processBatch) {
                // process the batch of messages
                await processor.processBatch(
                    messages.map((message) => ({
                        message: message.body.payload,
                        context: new WorkerQueueProcessorContext(
                            message,
                            this.container,
                        ),
                    })),
                );
                // acknowledge all messages in the batch
                for (const message of messages) {
                    message.ack();
                }
            } else {
                // A processor implementing neither process nor processBatch
                // would ack nothing and throw nothing, so the whole batch is
                // implicitly acked and silently dropped. Fail loud instead so
                // the platform retries and the misconfiguration is visible.
                throw new Error(
                    `Queue processor ${processorType.name} implements neither ` +
                        `process nor processBatch.`,
                );
            }
        } catch (error) {
            Logger.error(
                LogCategory.Queue,
                'Failed to process messages for type: %s',
                type,
                error,
            );
            // surface the failure to unhandled-exception listeners — the
            // deferred drain in Base.runDeferredActions delivers it even
            // though the error rethrows below. Fires on every failed
            // attempt (the platform retries); dedup is the listener's
            // concern.
            this.container
                .resolve(BaseEventBus)
                .defer<UnhandledExceptionEvent>({
                    name: UnhandledExceptionEventName,
                    error,
                    surface: 'queue',
                    detail: type,
                });
            // we need rethrow the error so that the queue can handle it
            // and retry the message
            // if we don't rethrow the error, the message will be acknowledged
            // and removed from the queue
            throw error;
        }
    }
}
