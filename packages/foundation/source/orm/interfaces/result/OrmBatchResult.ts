// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmDeleteResult } from './OrmDeleteResult';
import { OrmInsertResult } from './OrmInsertResult';
import { OrmUpdateResult } from './OrmUpdateResult';

/**
 * Result of `OrmAdapter.writeBatch(...)`. `results[i]` corresponds to the
 * operation at the same index in the input. `affectedRows` is the sum
 * across all operations for convenience.
 */
export interface OrmBatchResult {
    affectedRows: number;
    results: ReadonlyArray<
        | OrmInsertResult<object>
        | OrmUpdateResult<object>
        | OrmDeleteResult<object>
    >;
}
