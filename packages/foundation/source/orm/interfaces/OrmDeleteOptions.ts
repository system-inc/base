// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmFindOptionsOrder } from './find/OrmFindOptionsOrder';

/**
 * Bounds a conditions-based `delete` to a slice of the matching rows.
 *
 * Use it to batch bulk deletes: hosted MySQL (PlanetScale) aborts any single
 * DML statement that touches more than 100,000 rows, and even below that cap
 * a large delete holds locks and replication for its whole duration. Loop
 * with a `limit` until a batch comes back short:
 *
 * ```ts
 * do {
 *     ({ affectedRows } = await db.delete(Log, { createdAt: lt(cutoff) }, { limit: 10_000 }));
 * } while (affectedRows === 10_000);
 * ```
 *
 * Supported on every Base backend: MySQL natively, and SQLite on Durable
 * Objects, D1, and better-sqlite3 (all compiled with
 * `SQLITE_ENABLE_UPDATE_DELETE_LIMIT`).
 */
export interface OrmDeleteOptions<EntityType = object> {
    /**
     * Maximum number of rows to delete. A positive integer; the result's
     * `affectedRows` reports how many were actually removed, so a batch
     * that comes back short means the conditions are exhausted.
     */
    limit?: number;

    /**
     * Which matching rows go first when `limit` is set (oldest first, for
     * example). Without `limit` the order has no observable effect.
     */
    order?: OrmFindOptionsOrder<EntityType>;
}
