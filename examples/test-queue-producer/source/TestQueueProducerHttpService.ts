// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@system-inc/base-foundation/dependency-injection/decorators/Injectable';
import { InjectWorkerQueue } from '@system-inc/base-foundation/queue/decorators/InjectWorkerQueue';
import { WorkerQueue } from '@system-inc/base-foundation/queue/producer/WorkerQueue';
import { InjectRequestContext } from '@system-inc/base-foundation/request/decorators/RequestContextDecorator';
import { RequestContext } from '@system-inc/base-foundation/request/RequestContext';
import { HttpPath } from '@system-inc/base-foundation/router/decorators/HttpPath';
import { HttpQuery } from '@system-inc/base-foundation/router/decorators/HttpQuery';
import { HttpRoute } from '@system-inc/base-foundation/router/decorators/HttpRoute';
import { HttpService } from '@system-inc/base-foundation/router/decorators/HttpService';
import { TestQueueProducerInjections } from './TestQueueProducerInjections';

/**
 * Number of messages submitted per /enqueue call — enough to exercise
 * batching and concurrency in the consumer.
 */
const MESSAGE_COUNT = 24;

/**
 * Index of the single message that carries `shouldFail` (mid-batch, so
 * the retry path runs with successful messages on both sides of it).
 */
const FAILING_MESSAGE_INDEX = 4;

@Injectable()
@HttpService()
export class TestQueueProducerHttpService {
    constructor(
        @InjectWorkerQueue(TestQueueProducerInjections.TestQueue)
        private readonly testQueue: WorkerQueue,
    ) {}

    /**
     * Enqueues a batch of test messages.
     *
     * - `:timeout` — how long each message takes to process (ms).
     * - `?fetch=<anything>` — process via real network I/O: each message
     *   carries a URL to this worker's own `/block/:timeout` route, so the
     *   consumer's delay is genuine fetch latency instead of a timer. The
     *   URL is built from this request's origin, so it works identically
     *   on localhost and any deployed copy.
     * - `?shouldFail=true` — one mid-batch message throws, exercising the
     *   queue retry path.
     */
    @HttpRoute('GET', '/enqueue/:timeout')
    public async enqueue(
        @HttpPath('timeout') timeout: number,
        @InjectRequestContext() requestContext: RequestContext,
        @HttpQuery('fetch') fetch?: string,
        @HttpQuery('shouldFail') shouldFail?: string,
    ) {
        const fetchUrl = fetch
            ? new URL(`/block/${timeout}`, requestContext.url).toString()
            : undefined;

        this.testQueue.submit(
            Array.from({ length: MESSAGE_COUNT }, (_, index) => ({
                type: 'test',
                payload: {
                    timeout,
                    fetch: fetchUrl,
                    ...(index === FAILING_MESSAGE_INDEX
                        ? { shouldFail: shouldFail === 'true' }
                        : {}),
                },
            })),
        );
        return new Response('success');
    }

    /**
     * Waits `:timeout` ms before responding — the self-hosted slow
     * endpoint the `?fetch` path above points the consumer at.
     */
    @HttpRoute('GET', '/block/:timeout')
    async block(@HttpPath('timeout') timeout: number) {
        await new Promise((resolve) => setTimeout(resolve, timeout));
        return {
            test: 'test',
            test2: 'test2',
            test3: 'test3',
        };
    }
}
