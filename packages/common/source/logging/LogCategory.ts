// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * The framework's own log categories — the canonical list of what a
 * `LOG_LEVEL` directive (`warn,rpc=debug`) or `logging.categories` entry
 * can target. Framework code passes these to the static `Logger`
 * methods instead of string literals so a typo can't silently mint a
 * new category no override matches.
 *
 * Applications are not limited to this list — any string is a valid
 * category (`Logger.info('notes', ...)`).
 */
export const LogCategory = {
    /**
     * Engine boot, dispatch, and worker lifecycle.
     */
    Base: 'base',

    /**
     * HTTP routing and request handling.
     */
    Http: 'http',

    /**
     * RPC dispatch (and the client's calling path).
     */
    Rpc: 'rpc',

    /**
     * GraphQL schema and dispatch.
     */
    Gql: 'gql',

    /**
     * ORM: adapters, repositories, migrations.
     */
    Orm: 'orm',

    /**
     * Queue produce and consume.
     */
    Queue: 'queue',

    /**
     * Scheduled executables (cron + alarms).
     */
    Scheduled: 'scheduled',

    /**
     * WebSocket delegates and transport.
     */
    WebSocket: 'ws',

    /**
     * In-process event bus.
     */
    Event: 'event',

    /**
     * Key-value storage.
     */
    KeyValueStorage: 'kv',

    /**
     * Durable Object lifecycle.
     */
    Durable: 'durable',

    /**
     * `base-common` utilities.
     */
    Common: 'common',
} as const;

export type LogCategory = (typeof LogCategory)[keyof typeof LogCategory];
