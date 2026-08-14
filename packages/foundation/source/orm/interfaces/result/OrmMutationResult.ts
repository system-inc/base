// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

export type OrmMutationResult<TReturning = unknown> = {
    /**
     * Rows the statement addressed. DIALECT CAVEAT for UPDATE: SQLite
     * counts MATCHED rows, but MySQL (without CLIENT_FOUND_ROWS, which
     * the PlanetScale HTTP driver cannot enable) counts CHANGED rows —
     * an update that matches a row but leaves every value identical
     * reports 0 there. Do not use `affectedRows === 0` as an existence
     * check on updates in portable code; query the row instead. Upsert
     * counts are normalized (1 per operation on every dialect); deletes
     * count matched rows everywhere.
     */
    affectedRows?: number;
    returning?: TReturning[];
    raw?: unknown;
};
