// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Constructor } from '@system-inc/base-common/type/Constructor';
import { Dictionary } from '@system-inc/base-common/type/Dictionary';
import { WorkerQueueProcessorInterface } from '../../queue/consumer/WorkerQueueProcessor';

/**
 * Metadata for WorkerQueues. For combining settings passed in from
 * settings file and dynmically added queue settings from the system.
 */
export class WorkerQueueMetadata {
    private readonly consumers: Dictionary<
        Constructor<WorkerQueueProcessorInterface>
    > = {};

    addQueueProcessor(
        type: string | string[],
        processor: Constructor<WorkerQueueProcessorInterface>,
    ) {
        if (Array.isArray(type)) {
            for (const t of type) {
                this._addQueueProcessor(t, processor);
            }
        } else {
            this._addQueueProcessor(type, processor);
        }
    }

    getQueueProcessor(
        type: string,
    ): Constructor<WorkerQueueProcessorInterface> | undefined {
        return this.consumers[type];
    }

    private _addQueueProcessor(
        type: string,
        processor: Constructor<WorkerQueueProcessorInterface>,
    ): void {
        if (this.consumers[type]) {
            throw new Error(`Queue processor for type ${type} already exists`);
        }
        this.consumers[type] = processor;
    }
}
