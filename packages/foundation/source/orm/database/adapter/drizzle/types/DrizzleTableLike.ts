// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { type Column } from 'drizzle-orm';

/**
 * Structural shape of a Drizzle table used by adapter internals. Drizzle's
 * dialect-specific table types (`SQLiteTable`, `MySqlTable`, `PgTable`) are
 * heavily inferred from schema definitions — accepting one of them as a
 * parameter forces the caller through that inference. This shape captures
 * just the dynamic-column-lookup behavior the shared helpers actually need.
 */
export type DrizzleTableLike = Record<string, Column | undefined>;

/**
 * Structural shape of a Drizzle relational query handle (`db.query.{table}`).
 * The concrete type Drizzle exposes is heavily generic and not part of the
 * public surface; we only need the two finders.
 */
export interface DrizzleTableQuery {
    findMany(options?: unknown): Promise<unknown>;
    findFirst(options?: unknown): Promise<unknown>;
}
