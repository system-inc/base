// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    WorkerQueueProcessorContext,
    WorkerQueueProcessorInterface,
} from '@system-inc/base-foundation/queue/consumer/WorkerQueueProcessor';
import { WorkerQueueProcessor } from '@system-inc/base-foundation/queue/decorators/WorkerQueueProcessor';

export interface TestMessageType {
    timeout: number;
    /**
     * URL to fetch instead of waiting on a timer — the producer points
     * this at its own `/block/:timeout` route, so processing is genuine
     * network I/O with no hardcoded host.
     */
    fetch?: string;
    shouldFail?: boolean;
}

@WorkerQueueProcessor('test')
export class TestBatchQueueProcessor implements WorkerQueueProcessorInterface<TestMessageType> {
    async processBatch(
        batch: readonly {
            message: TestMessageType;
            context: WorkerQueueProcessorContext;
        }[],
    ): Promise<void> {
        console.log('Processing batch of messages:', batch);
        const startTime = performance.now();
        for (const message of batch) {
            if (message.message.fetch) {
                console.log('Fetching....');
                try {
                    const response = await fetch(message.message.fetch);
                    console.log(
                        'Response:',
                        response.status,
                        response.statusText,
                    );
                } catch (error) {
                    console.log('Error fetching:', error);
                }
            } else {
                console.log('Waiting....');
                await new Promise((resolve) =>
                    setTimeout(resolve, message.message.timeout),
                );
            }
            if (message.message.shouldFail) {
                throw new Error('Simulated failure');
            }
            message.context.acknowledge();
        }
        const duration = performance.now() - startTime;
        console.log(
            'Finished processing messages, batch size:',
            batch.length,
            'Duration:',
            duration,
        );
    }
}
