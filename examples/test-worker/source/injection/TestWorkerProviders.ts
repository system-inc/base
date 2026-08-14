// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Provider } from '@system-inc/base-foundation/dependency-injection/decorators/Provider';
import { TestWorkerInjections } from './TestWorkerInjections';

export class TestWorkerProviders {
    @Provider(TestWorkerInjections.TestDatabase)
    static testDatabaseProvider(): string {
        return 'Test';
    }
}
