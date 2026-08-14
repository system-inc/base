// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import type { LogLevel } from '@system-inc/base-common/logging/LogLevel';

/**
 * Logging settings for a Base Worker (`BaseSettings.logging`). These are
 * the in-code defaults; the `LOG_LEVEL` environment variable overrides
 * `level` and `categories` at deploy time (e.g.
 * `LOG_LEVEL=warn,rpc=debug`).
 */
export interface LoggingSettings {
    /**
     * The default log threshold. Defaults to `LogLevel.Info`.
     */
    readonly level?: LogLevel;

    /**
     * Per-category thresholds overriding `level`, keyed by the category
     * name passed to `Logger.create` (e.g. `{ rpc: LogLevel.Debug }`).
     * The framework's own categories include `base`, `http`, `rpc`,
     * `gql`, `orm`, `queue`, `scheduled`, `ws`, `event`, `kv`,
     * `durable`, `common`.
     */
    readonly categories?: Record<string, LogLevel>;

    /**
     * Whether to emit the per-request log line
     * (`GET /notes 200 OK (12ms)`). Defaults to true. This is a request
     * log, not an application log — it is the single most expensive log
     * line on the hot path, so it has its own switch: turn it off for
     * maximum throughput while keeping `info` elsewhere.
     */
    readonly requestLog?: boolean;
}
