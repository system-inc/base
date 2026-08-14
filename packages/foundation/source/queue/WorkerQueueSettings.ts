// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Settings related to queues for the Base Worker.
 */
export interface WorkerQueueSettings {
    /**
     * Queue bindings that the Base Worker will have access to.
     * These are the queues that the Base Worker will produce messages to.
     */
    bindings?: string[];
}
