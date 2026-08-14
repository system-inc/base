// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { InjectionToken, injectWithTransform } from 'tsyringe';

import { Injectable } from '../../dependency-injection/decorators/Injectable';
import { InjectionTransform } from '../../dependency-injection/InjectionTransform';
import { TypedParameterDecorator } from '../../dependency-injection/TypedParameterDecorator';
import { WorkerQueueService } from '../../internal/queue/producer/WorkerQueueService';
import { WorkerQueue } from '../producer/WorkerQueue';
import { WorkerQueueBinding } from '../WorkerQueueBinding';

/**
 * Injects a WorkerQueue bound to the queue declared by the given
 * `WorkerQueueBinding<MessageType>`. The resolved
 * `WorkerQueue<MessageType>` is verified against the parameter's
 * declared type at lint time.
 */
export function InjectWorkerQueue<MessageType = unknown>(
    queueToken: WorkerQueueBinding<MessageType>,
): TypedParameterDecorator<WorkerQueue<MessageType>> {
    return injectWithTransform(
        WorkerQueueService,
        QueueTransform,
        queueToken.toString(),
    ) as TypedParameterDecorator<WorkerQueue<MessageType>>;
}

/**
 * Used to resolve queueToken into an instance of the WorkerQueue.
 */
@Injectable()
class QueueTransform implements InjectionTransform<
    WorkerQueueService,
    WorkerQueue
> {
    public transform(
        workerQueueService: WorkerQueueService,
        queueToken: InjectionToken,
    ): WorkerQueue {
        return workerQueueService.getQueue(queueToken);
    }
}
