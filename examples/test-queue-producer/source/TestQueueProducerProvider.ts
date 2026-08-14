// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Provider } from '@system-inc/base-foundation/dependency-injection/decorators/Provider';
import { TestQueueProducerInjections } from './TestQueueProducerInjections';

export class TestQueueProducerProvider {
    @Provider(TestQueueProducerInjections.TestQueue)
    provideTestQueue(): string {
        return 'TEST_QUEUE';
    }
}
