// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { DecoratorRegistry } from '@system-inc/base-common/decorator/DecoratorRegistry';
import { Constructor } from '@system-inc/base-common/type/Constructor';
import { getBaseMetadata } from '../../base/BaseMetadata';
import { WorkerQueueProcessorInterface } from '../consumer/WorkerQueueProcessor';

export const WorkerQueueProcessorDecoratorName = 'WorkerQueueProcessor';

/**
 * This decorator is used to register
 * a class as a processor for a specific message type(s).
 */
export function WorkerQueueProcessor(type: string | string[]) {
    return function <
        T extends new (...args: any[]) => WorkerQueueProcessorInterface,
    >(constructor: T) {
        DecoratorRegistry.get().mark(
            constructor as Constructor<object>,
            WorkerQueueProcessorDecoratorName,
        );
        getBaseMetadata().queue.addQueueProcessor(type, constructor);
    };
}
