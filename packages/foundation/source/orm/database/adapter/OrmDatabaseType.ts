// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * SQL dialect spoken by the database. Determines syntax-level behavior
 * (e.g. `ON CONFLICT` vs `ON DUPLICATE KEY UPDATE`, `RETURNING` vs
 * `lastInsertId`). Adapters branch on this.
 */
export type OrmDatabaseDialect = 'sqlite' | 'mysql';

/**
 * Identifies a database backend as a (dialect, driver) pair. Dialect is
 * the SQL syntax; driver is the specific client library / deployment
 * surface used to reach it. Providers branch on the pair to know which
 * connection setup applies.
 */
export type OrmDatabaseType =
    | { dialect: 'sqlite'; driver: 'd1' | 'durable' | 'better-sqlite' }
    | { dialect: 'mysql'; driver: 'planetscale' };

/**
 * Extract the database-type entries that match the given dialect. Useful
 * for typing adapter generics that work across all drivers of one dialect
 * (e.g. the SQLite abstract base accepts all `sqlite` drivers).
 */
export type OrmDatabaseTypeOfDialect<TDialect extends OrmDatabaseDialect> =
    Extract<OrmDatabaseType, { dialect: TDialect }>;
