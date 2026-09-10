// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmFindOptionsOrder } from './find/OrmFindOptionsOrder';

/**
 * Bounds a conditions-based `update` to a slice of the matching rows.
 *
 * The same batching tool as `OrmDeleteOptions`: hosted MySQL (PlanetScale)
 * aborts any single DML statement that touches more than 100,000 rows, so a
 * wide backfill or status sweep loops with a `limit` until a batch comes
 * back short. Supported on every Base backend (MySQL natively; SQLite on
 * Durable Objects, D1, and better-sqlite3 via
 * `SQLITE_ENABLE_UPDATE_DELETE_LIMIT`).
 */
export interface OrmUpdateOptions<EntityType = object> {
    /**
     * Maximum number of rows to update. A positive integer; the result's
     * `affectedRows` reports how many were actually changed.
     */
    limit?: number;

    /**
     * Which matching rows go first when `limit` is set. Without `limit` the
     * order has no observable effect.
     */
    order?: OrmFindOptionsOrder<EntityType>;
}
