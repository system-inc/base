// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { WorkerQueueBinding } from '@system-inc/base-foundation/queue/WorkerQueueBinding';

export namespace TestQueueProducerInjections {
    export const TestQueue = new WorkerQueueBinding<unknown>(
        'TestQueueProducerInjections.TestQueue',
    );
}
