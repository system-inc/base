// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseSettings } from '@system-inc/base-foundation/base/BaseSettings';
import { TestBatchQueueProcessor } from './source/TestQueueBatchProcessor';

export const TestQueueConsumerSettings: BaseSettings = {
    name: 'test-queue-consumer',
    version: '0.0.1',
    title: 'Test Queue Consumer',
    server: {
        '@default': {
            port: 3002,
        },
    },
    services: [TestBatchQueueProcessor],
    deployEnvironment: [],
};
