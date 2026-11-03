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

    /**
     * The cron triggers the Node runner fires. On Cloudflare the triggers
     * are `wrangler.toml`'s `[triggers] crons`, which Base never reads; on
     * Node, the runner fires these itself. Defaults to every cron
     * expression a registered executable is registered against — set it
     * to fire `CRON_ANY_TRIGGER` executables, or to fire a subset.
     */
    triggers?: string[];
}
