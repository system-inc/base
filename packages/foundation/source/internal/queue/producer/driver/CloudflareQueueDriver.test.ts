// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { CloudflareQueueDriver } from './CloudflareQueueDriver';
import { WorkerQueueMessageWithOptions } from './WorkerQueueDriver';

function messages(count: number): WorkerQueueMessageWithOptions[] {
    return Array.from({ length: count }, (_, i) => ({
        message: { payload: i } as never,
    }));
}

describe('CloudflareQueueDriver.submitMessageBatch', () => {
    it('leaves only the un-sent messages buffered when a later chunk fails', async () => {
        let call = 0;
        const queue = {
            sendBatch: (batch: unknown[]) => {
                call++;
                if (call === 2) {
                    throw new Error('chunk 2 failed');
                }
                return Promise.resolve(batch);
            },
        } as unknown as Queue;

        const driver = new CloudflareQueueDriver('BINDING', queue);
        const buffer = messages(150);

        // 150 messages -> chunk 1 (100) accepted, chunk 2 (50) throws
        await expect(driver.submitMessageBatch(buffer)).rejects.toThrow(
            'chunk 2 failed',
        );

        // the 100 accepted messages were removed; only the 50 un-sent remain,
        // so a retry re-sends exactly those and never re-delivers chunk 1
        expect(buffer).toHaveLength(50);
        expect(buffer[0]!.message).toEqual({ payload: 100 });
    });

    it('empties the buffer when every chunk is accepted', async () => {
        const queue = {
            sendBatch: (batch: unknown[]) => Promise.resolve(batch),
        } as unknown as Queue;
        const driver = new CloudflareQueueDriver('BINDING', queue);
        const buffer = messages(250);

        await driver.submitMessageBatch(buffer);

        expect(buffer).toHaveLength(0);
    });
});
