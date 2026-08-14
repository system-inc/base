// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

export interface OrmAdapterOptions {
    /**
     * Enable or disable logging of SQL queries.
     *
     * Defaults to false.
     */
    logging?: boolean;
}

export function ormIsAdapterOptions(obj: unknown): obj is OrmAdapterOptions {
    return typeof obj === 'object' && obj !== null && 'logging' in obj;
}
