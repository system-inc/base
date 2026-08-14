// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Scheduled executor settings. These are settings for Executables that
 * can be run as as a result of a schedule() call (Cloudflare Cron Job) or
 * a DurableObject alarm() call.
 */
export interface ScheduledSettings {
    /**
     * The number of Executables that can be run concurrently.
     * Default is 1 (no concurrency).
     */
    concurrency?: number;
}
