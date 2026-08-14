// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

export interface OrmTableOptions {
    comment?: string;

    /**
     * Whether this table may be wiped via `truncate()`.
     *
     * Defaults to `false`. Tables that are not explicitly marked as
     * truncatable will throw at runtime when `truncate()` is called,
     * preventing accidental full-table deletion.
     *
     * Typically only used for test fixtures, ephemeral caches, and
     * tables whose rows are regenerated from a source of truth.
     */
    truncatable?: boolean;
}
