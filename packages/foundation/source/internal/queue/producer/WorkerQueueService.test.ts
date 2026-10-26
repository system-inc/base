// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseWorkerContext } from '../../../worker/BaseWorkerContext';
import { CloudflareQueueDriver } from './driver/CloudflareQueueDriver';
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

/**
 * The service is worker-scoped, so every concurrent event in an isolate
 * shares its buffer and any of them may drain it. A drain used to read
 * the shared array, await the send, then splice it: two overlapping
 * drains sent the same leading batch twice, then each spliced a batch,
 * dropping messages neither had sent.
 */
describe('WorkerQueueService concurrent drains', () => {
    // A Cloudflare Queue whose sendBatch stays open until released, so two
    // drains can be in flight at once — as with concurrent requests.
    function heldQueue(): {
        queue: Queue;
        sent: unknown[];
        release: () => void;
    } {
        const sent: unknown[] = [];
        const waiting: Array<() => void> = [];
        const queue = {
            send: async () => {},
            sendBatch: async (batch: Array<{ body: unknown }>) => {
                await new Promise<void>((resolve) => waiting.push(resolve));
                sent.push(...batch.map((entry) => entry.body));
            },
        } as unknown as Queue;
        return {
            queue,
            sent,
            release: () => waiting.splice(0).forEach((resolve) => resolve()),
        };
    }

    async function settle(release: () => void): Promise<void> {
        for (let i = 0; i < 20; i++) {
            release();
            await new Promise((resolve) => setImmediate(resolve));
        }
    }

    function payloads(count: number, offset = 0): number[] {
        return Array.from({ length: count }, (_, index) => index + offset);
    }

    it('sends every buffered message exactly once across overlapping drains', async () => {
        const { queue, sent, release } = heldQueue();
        const service = serviceWith(
            {},
            { jobs: new CloudflareQueueDriver('jobs', queue) },
        );
        for (const payload of payloads(150)) {
            service.enqueue('jobs', { type: 'job', payload });
        }

        // request A's and request B's post-response drains overlap
        const first = service.drain();
        const second = service.drain();
        await settle(release);
        await Promise.all([first, second]);

        expect(
            sent
                .map((body) => (body as { payload: number }).payload)
                .sort((a, b) => a - b),
        ).toEqual(payloads(150));
    });

    it('keeps messages enqueued during a drain for the next drain', async () => {
        const { queue, sent, release } = heldQueue();
        const service = serviceWith(
            {},
            { jobs: new CloudflareQueueDriver('jobs', queue) },
        );
        service.enqueue('jobs', { type: 'job', payload: 1 });

        const draining = service.drain();
        // another request enqueues while the first drain's send is open
        service.enqueue('jobs', { type: 'job', payload: 2 });
        await settle(release);
        await draining;
        const nextDrain = service.drain();
        await settle(release);
        await nextDrain;

        expect(sent).toEqual([
            { type: 'job', payload: 1 },
            { type: 'job', payload: 2 },
        ]);
    });

    it('puts a failed send back ahead of messages enqueued meanwhile', async () => {
        let fail = true;
        const order: number[] = [];
        const driver: WorkerQueueDriver = {
            async submitMessageBatch(messages) {
                if (fail) {
                    throw new Error('queue unavailable');
                }
                order.push(
                    ...messages.map(
                        (entry) =>
                            (entry.message as { payload: number }).payload,
                    ),
                );
                messages.length = 0;
            },
        };
        const service = serviceWith({}, { jobs: driver });
        service.enqueue('jobs', { type: 'job', payload: 1 });

        await expect(service.drain()).rejects.toThrow('queue unavailable');
        service.enqueue('jobs', { type: 'job', payload: 2 });
        fail = false;
        await service.drain();

        expect(order).toEqual([1, 2]);
    });
});
