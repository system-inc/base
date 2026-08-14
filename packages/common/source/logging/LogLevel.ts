// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Severity levels for {@link Logger}, ordered numerically so the emit
 * decision is a single integer compare: a message is emitted when its
 * level is at or above the configured threshold. `Off` disables all
 * output.
 */
export enum LogLevel {
    Debug = 0,
    Info = 1,
    Warn = 2,
    Error = 3,
    Off = 4,
}

const logLevelsByName: Record<string, LogLevel> = {
    debug: LogLevel.Debug,
    info: LogLevel.Info,
    warn: LogLevel.Warn,
    error: LogLevel.Error,
    off: LogLevel.Off,
};

/**
 * Parses a level name (case-insensitive, e.g. `'warn'`) into a
 * {@link LogLevel}. Returns undefined for an unrecognized name — callers
 * decide whether that's a default or an error.
 */
export function parseLogLevel(name: string): LogLevel | undefined {
    return logLevelsByName[name.trim().toLowerCase()];
}
