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
export class TestQueueProcessor implements WorkerQueueProcessorInterface<TestMessageType> {
    async process(
        testMessage: Readonly<TestMessageType>,
        _context: WorkerQueueProcessorContext,
    ): Promise<void> {
        console.log('Processing message:', JSON.stringify(testMessage));
        const startTime = performance.now();
        if (testMessage.fetch) {
            console.log('Fetching....');
            try {
                const response = await fetch(testMessage.fetch);
                console.log('Response:', response.status, response.statusText);
            } catch (error) {
                console.log('Error fetching:', error);
            }
        } else {
            console.log('Waiting....');
            await new Promise((resolve) =>
                setTimeout(resolve, testMessage.timeout),
            );
        }
        if (testMessage.shouldFail) {
            throw new Error('Simulated failure');
        }
        const duration = performance.now() - startTime;
        console.log(
            'Finished processing message:',
            JSON.stringify(testMessage),
            'Duration:',
            duration,
        );
    }
}
