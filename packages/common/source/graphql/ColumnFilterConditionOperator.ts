// Copyright 2026 System, Inc.
// SPDX-License-Identifier: Apache-2.0

export enum ColumnFilterConditionOperator {
    Equal = 'Equal',
    NotEqual = 'NotEqual',
    GreaterThan = 'GreaterThan',
    GreaterThanOrEqual = 'GreaterThanOrEqual',
    LessThan = 'LessThan',
    LessThanOrEqual = 'LessThanOrEqual',
    Like = 'Like',
    NotLike = 'NotLike',
    In = 'In',
    NotIn = 'NotIn',
    IsNull = 'IsNull',
    IsNotNull = 'IsNotNull',
}
