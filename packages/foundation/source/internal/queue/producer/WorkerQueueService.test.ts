// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseWorkerContext } from '../../../worker/BaseWorkerContext';
import {
    WorkerQueueDriver,
    WorkerQueueMessageWithOptions,
    WorkerQueueSubmitOptions,
} from './driver/WorkerQueueDriver';
import { WorkerQueueService } from './WorkerQueueService';

// A driver that empties the buffer (fully drained), mimicking the
// consume-in-place contract.
class DrainingDriver implements WorkerQueueDriver {
    async submitMessageBatch(
        messages: WorkerQueueMessageWithOptions[],
        _options?: WorkerQueueSubmitOptions,
    ): Promise<void> {
        messages.length = 0;
    }
}

// A driver that always throws without accepting anything.
class FailingDriver implements WorkerQueueDriver {
    async submitMessageBatch(): Promise<void> {
        throw new Error('driver failed');
    }
}

function serviceWith(
    queues: Record<string, WorkerQueueMessageWithOptions[]>,
    drivers: Record<string, WorkerQueueDriver>,
): WorkerQueueService {
    const service = new WorkerQueueService({} as BaseWorkerContext);
    (service as unknown as { queues: unknown }).queues = queues;
    (service as unknown as { queueDrivers: unknown }).queueDrivers = drivers;
    return service;
}

function message(id: number): WorkerQueueMessageWithOptions {
    return { message: { payload: id } as never };
}

describe('WorkerQueueService.drain', () => {
    it('drains every queue even when one fails, and surfaces the failure', async () => {
        const queues = {
            good: [message(1)],
            bad: [message(2)],
            alsoGood: [message(3)],
        };
        const drivers = {
            good: new DrainingDriver(),
            bad: new FailingDriver(),
            alsoGood: new DrainingDriver(),
        };
        const service = serviceWith(queues, drivers);

        await expect(service.drain()).rejects.toThrow('driver failed');

        // the healthy queues still drained despite `bad` throwing
        expect(queues.good).toBeUndefined();
        expect(queues.alsoGood).toBeUndefined();
        // the failed queue keeps its messages buffered for retry
        expect(queues.bad).toEqual([message(2)]);
    });

    it('keeps a partially-sent queue buffered with only the un-sent remainder', async () => {
        // driver accepts the first message then throws, leaving the rest
        const partialDriver: WorkerQueueDriver = {
            async submitMessageBatch(messages) {
                messages.shift();
                throw new Error('partial failure');
            },
        };
        const queues = { q: [message(1), message(2)] };
        const service = serviceWith(queues, { q: partialDriver });

        await expect(service.drain()).rejects.toThrow('partial failure');

        // message(1) was accepted and removed; message(2) stays for retry
        expect(queues.q).toEqual([message(2)]);
    });
});
