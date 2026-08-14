// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseSettings } from '@system-inc/base-foundation/base/BaseSettings';
import { TestQueueProcessor } from './source/TestQueueProcessor';
import { TestQueueProducerHttpService } from './source/TestQueueProducerHttpService';
import { TestQueueProducerProvider } from './source/TestQueueProducerProvider';

export const TestQueueProducerSettings: BaseSettings = {
    name: 'test-queue-producer',
    version: '0.0.1',
    title: 'Test Queue Producer',
    server: {
        '@default': {
            port: 3001,
        },
    },
    services: [
        TestQueueProducerHttpService,
        TestQueueProcessor,
        TestQueueProducerProvider,
    ],
    queue: {
        bindings: ['TEST_QUEUE'],
    },
    deployEnvironment: [],
};
