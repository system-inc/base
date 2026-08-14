// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Json } from '../json/Json';
import { ColumnFilterConditionOperator } from './ColumnFilterConditionOperator';

export interface ColumnFilterInput {
    operator: ColumnFilterConditionOperator;
    column: string;
    value: Json;
}
