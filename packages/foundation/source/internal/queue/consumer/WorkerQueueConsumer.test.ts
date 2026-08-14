// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { getBaseMetadata } from '../../../base/BaseMetadata';
import { BaseInjectionContainer } from '../../../dependency-injection/BaseInjectionContainer';
import { WorkerQueueProcessorMessage } from '../../../queue/WorkerQueueMessage';
import { WorkerQueueConsumer } from './WorkerQueueConsumer';

// A processor implementing neither process nor processBatch — structurally
// valid because both are optional on the interface.
class NeitherProcessor {}

const container = {
    resolve: (ctor: new () => unknown) => new ctor(),
} as unknown as BaseInjectionContainer;

describe('WorkerQueueConsumer', () => {
    it('throws (rather than silently dropping the batch) for a processor with neither method', async () => {
        const type = 'neither-type';
        getBaseMetadata().queue.addQueueProcessor(type, NeitherProcessor);

        let acked = false;
        const message = {
            body: { type: type, payload: {} },
            ack: () => {
                acked = true;
            },
            retry: () => {},
        } as unknown as WorkerQueueProcessorMessage;

        const consumer = new WorkerQueueConsumer(container, [NeitherProcessor]);

        await expect(consumer.processMessages([message])).rejects.toThrow(
            /implements neither process nor processBatch/,
        );
        // the message must not be acked — the platform should retry it
        expect(acked).toBe(false);
    });
});
