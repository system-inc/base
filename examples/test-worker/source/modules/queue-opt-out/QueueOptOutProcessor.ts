// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import {
    WorkerQueueProcessorContext,
    WorkerQueueProcessorInterface,
} from '@system-inc/base-foundation/queue/consumer/WorkerQueueProcessor';
import { WorkerQueueProcessor } from '@system-inc/base-foundation/queue/decorators/WorkerQueueProcessor';

export interface QueueOptOutMessage {
    value: string;
}

@WorkerQueueProcessor('queue-opt-out.test')
export class QueueOptOutProcessor implements WorkerQueueProcessorInterface<QueueOptOutMessage> {
    async process(
        message: Readonly<QueueOptOutMessage>,
        _context: WorkerQueueProcessorContext,
    ): Promise<void> {
        console.log('QueueOptOutProcessor received:', JSON.stringify(message));
    }
}
