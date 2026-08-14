// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { TypedInjectionKey } from '@system-inc/base-foundation/dependency-injection/TypedInjectionKey';

export class TestWorkerInjections {
    static readonly TestDatabase = new TypedInjectionKey<string>(
        'TestWorkerInjections.TestDatabase',
    );
}
