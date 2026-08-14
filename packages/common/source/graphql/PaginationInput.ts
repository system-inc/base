// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { ColumnFilterInput } from './ColumnFilterInput';
import { OrderByInput } from './OrderByInput';

export interface PaginationInput {
    itemsPerPage: number;
    itemIndex?: number;
    filters?: ColumnFilterInput[];
    orderBy?: OrderByInput[];
}
