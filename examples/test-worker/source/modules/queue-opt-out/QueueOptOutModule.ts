// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { BaseModuleKey } from '@system-inc/base-foundation/configuration/BaseModuleKey';
import { BaseModule } from '@system-inc/base-foundation/module/BaseModule';
import { QueueOptOutProcessor } from './QueueOptOutProcessor';

export const QueueOptOutModuleKey = BaseModuleKey.create('QueueOptOut');

/**
 * Fixture module whose only service is a `@WorkerQueueProcessor`. test-worker
 * registers it with `.with({ queue: false })`, so the processor is imported
 * (and therefore present in the decoration-time metadata) but stripped from
 * the manifest's queue bucket. `base check` must accept this worker without a
 * `[[queues.consumers]]` declaration — membership checks read the manifest,
 * not import-time metadata.
 */
export function QueueOptOut(): BaseModule<unknown> {
    return BaseModule.create({
        key: QueueOptOutModuleKey,
        settings: {
            services: [QueueOptOutProcessor],
        },
    });
}
