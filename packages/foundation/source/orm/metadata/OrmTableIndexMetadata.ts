// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { OrmIndexColumn } from '../interfaces/OrmIndexColumn';
import { OrmTableIndexOptions } from '../interfaces/OrmTableIndexOptions';

export interface OrmTableIndexMetadata {
    name?: string;

    /**
     * The indexed columns. Usually plain property names; an entry may carry a
     * `prefixLength` when the column is too wide to index whole (see
     * `OrmIndexColumn`).
     */
    columns: OrmIndexColumn[];

    options?: OrmTableIndexOptions;
}
